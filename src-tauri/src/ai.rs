//! Local-AI backend (desktop only).
//!
//! Architecture: we don't compile an inference engine into the app. Instead we
//! download the official llama.cpp `llama-server` binary, run it as a child
//! process bound to a local port, and talk to its OpenAI-compatible HTTP API.
//! That keeps the GGUF self-contained (tokenizer + chat template embedded), needs
//! no C++/CMake build, and reuses `reqwest`. Requests run from Rust, so HF/GitHub
//! redirects are followed and the webview CSP is never involved.
//!
//! Commands:
//!   - model:  `ai_model_exists`, `ai_download`, `ai_remove`
//!   - engine: `ai_server_installed`, `ai_server_install`, `ai_start`, `ai_stop`,
//!             `ai_engine_running`
//!   - infer:  `ai_generate` (streams `ai-token` events, resolves with full text)

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// Running llama-server child + the port it listens on.
struct ServerProc {
    child: std::process::Child,
    port: u16,
}

#[derive(Default)]
pub struct AiState {
    server: Mutex<Option<ServerProc>>,
}

#[derive(Clone, Serialize)]
struct Progress {
    downloaded: u64,
    total: u64,
}

/// A streamed token, tagged with the request id so concurrent generations (e.g.
/// the game review and a per-move comment) route to the right listener.
#[derive(Clone, Serialize)]
struct TokenEvent {
    id: String,
    token: String,
}

#[derive(Clone, Serialize)]
struct DoneEvent {
    id: String,
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

fn data_subdir(app: &AppHandle, sub: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(sub);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    data_subdir(app, "models")
}

fn engine_dir(app: &AppHandle) -> Result<PathBuf, String> {
    data_subdir(app, "engine")
}

const SERVER_EXE: &str = if cfg!(windows) { "llama-server.exe" } else { "llama-server" };

/// Recursively find the `llama-server` binary under the engine dir.
fn find_server_binary(dir: &Path) -> Option<PathBuf> {
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let p = entry.path();
        if p.is_dir() {
            if let Some(found) = find_server_binary(&p) {
                return Some(found);
            }
        } else if p.file_name().and_then(|n| n.to_str()) == Some(SERVER_EXE) {
            return Some(p);
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Model file
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_model_exists(app: AppHandle, file_name: String) -> Result<bool, String> {
    Ok(models_dir(&app)?.join(&file_name).exists())
}

#[tauri::command]
pub async fn ai_remove(app: AppHandle, file_name: String) -> Result<(), String> {
    let path = models_dir(&app)?.join(&file_name);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Stream `url` into `<models>/<file_name>` (via a `.part` rename), emitting
/// `ai-download-progress`.
#[tauri::command]
pub async fn ai_download(app: AppHandle, url: String, file_name: String) -> Result<String, String> {
    let dir = models_dir(&app)?;
    let path = dir.join(&file_name);
    download_to(&app, &url, &path, "ai-download-progress").await?;
    Ok(path.to_string_lossy().into_owned())
}

/// Generic streamed download to `path` (writes `<path>.part`, then renames).
async fn download_to(app: &AppHandle, url: &str, path: &Path, event: &str) -> Result<(), String> {
    let tmp = path.with_extension("part");
    let client = reqwest::Client::builder()
        .user_agent("chess-mini")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);

    let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let _ = app.emit(event, Progress { downloaded, total });
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Engine (llama-server) install
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_server_installed(app: AppHandle) -> Result<bool, String> {
    Ok(find_server_binary(&engine_dir(&app)?).is_some())
}

/// Download the latest llama.cpp `llama-server` for this platform and extract it
/// into the engine dir. Emits `ai-engine-progress` during the download.
#[tauri::command]
pub async fn ai_server_install(app: AppHandle) -> Result<(), String> {
    // Only Windows x64 auto-install is wired for now; other platforms can drop a
    // llama-server build into the engine dir manually.
    if !cfg!(target_os = "windows") {
        return Err("Automatic engine install is currently Windows-only.".into());
    }

    let client = reqwest::Client::builder()
        .user_agent("chess-mini")
        .build()
        .map_err(|e| e.to_string())?;
    let release: serde_json::Value = client
        .get("https://api.github.com/repos/ggml-org/llama.cpp/releases/latest")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let assets = release["assets"]
        .as_array()
        .ok_or("Unexpected GitHub response (no assets)")?;
    let url = assets
        .iter()
        .find_map(|a| {
            let name = a["name"].as_str()?;
            let n = name.to_lowercase();
            if n.contains("bin-win") && n.contains("x64") && n.contains("cpu") && n.ends_with(".zip") {
                a["browser_download_url"].as_str()
            } else {
                None
            }
        })
        .ok_or("No matching llama-server build (win x64 cpu) in the latest release")?
        .to_string();

    let dir = engine_dir(&app)?;
    let zip_path = dir.join("llama-server.zip");
    download_to(&app, &url, &zip_path, "ai-engine-progress").await?;
    extract_zip(&zip_path, &dir)?;
    std::fs::remove_file(&zip_path).ok();

    if find_server_binary(&dir).is_none() {
        return Err("Engine archive did not contain llama-server.".into());
    }
    Ok(())
}

fn extract_zip(zip_path: &Path, out_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = entry.enclosed_name() else { continue };
        let out = out_dir.join(rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut f = std::fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Engine run
// ---------------------------------------------------------------------------

fn free_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    Ok(port)
}

#[tauri::command]
pub fn ai_engine_running(state: State<'_, AiState>) -> bool {
    state.server.lock().unwrap().is_some()
}

/// Spawn llama-server for `model_file` and wait until its `/health` is ready.
#[tauri::command]
pub async fn ai_start(
    app: AppHandle,
    state: State<'_, AiState>,
    model_file: String,
) -> Result<u16, String> {
    if let Some(s) = state.server.lock().unwrap().as_ref() {
        return Ok(s.port);
    }

    let bin = find_server_binary(&engine_dir(&app)?).ok_or("Engine is not installed.")?;
    let model = models_dir(&app)?.join(&model_file);
    if !model.exists() {
        return Err("Model is not downloaded.".into());
    }
    let port = free_port()?;

    let mut cmd = std::process::Command::new(&bin);
    cmd.arg("-m")
        .arg(&model)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .arg("-c")
        .arg("4096");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let child = cmd.spawn().map_err(|e| e.to_string())?;
    *state.server.lock().unwrap() = Some(ServerProc { child, port });

    // Poll until the server is ready (model load can take a while).
    let client = reqwest::Client::new();
    for _ in 0..120 {
        if let Ok(r) = client
            .get(format!("http://127.0.0.1:{port}/health"))
            .send()
            .await
        {
            if r.status().is_success() {
                return Ok(port);
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    // Never came up — tear it down.
    stop_locked(&state);
    Err("The engine did not become ready in time.".into())
}

fn stop_locked(state: &State<'_, AiState>) {
    if let Some(mut s) = state.server.lock().unwrap().take() {
        let _ = s.child.kill();
        let _ = s.child.wait();
    }
}

#[tauri::command]
pub fn ai_stop(state: State<'_, AiState>) -> Result<(), String> {
    stop_locked(&state);
    Ok(())
}

/// Kill the server on app shutdown (called from the run-event handler).
pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<AiState>() {
        if let Some(mut s) = state.server.lock().unwrap().take() {
            let _ = s.child.kill();
            let _ = s.child.wait();
        }
    }
}

// ---------------------------------------------------------------------------
// Inference (streaming chat completion)
// ---------------------------------------------------------------------------

/// Stream a chat completion from the running server. Emits each token as an
/// `ai-token` event and resolves with the full text.
#[tauri::command]
pub async fn ai_generate(
    app: AppHandle,
    state: State<'_, AiState>,
    request_id: String,
    system: String,
    user: String,
    max_tokens: u32,
) -> Result<String, String> {
    let port = state
        .server
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.port)
        .ok_or("Engine is not running.")?;

    let body = serde_json::json!({
        "model": "local",
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
        "stream": true,
        "temperature": 0.4,
        "max_tokens": max_tokens,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://127.0.0.1:{port}/v1/chat/completions"))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Generation failed: HTTP {}", resp.status()));
    }

    let mut full = String::new();
    let mut buf: Vec<u8> = Vec::new();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buf.extend_from_slice(&chunk);

        // Process complete `\n`-terminated lines (Server-Sent Events).
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line);
            let line = line.trim();
            let Some(data) = line.strip_prefix("data:") else { continue };
            let data = data.trim();
            if data == "[DONE]" {
                let _ = app.emit("ai-done", DoneEvent { id: request_id.clone() });
                return Ok(full);
            }
            if data.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(tok) = v["choices"][0]["delta"]["content"].as_str() {
                    if !tok.is_empty() {
                        full.push_str(tok);
                        let _ = app.emit(
                            "ai-token",
                            TokenEvent { id: request_id.clone(), token: tok.to_string() },
                        );
                    }
                }
            }
        }
    }
    let _ = app.emit("ai-done", DoneEvent { id: request_id });
    Ok(full)
}

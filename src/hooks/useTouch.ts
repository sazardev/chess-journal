import { useState } from "react"

/**
 * True on touch / mobile devices (Android build, phones, tablets). Used to drop
 * desktop-only chrome (window controls) and reveal touch affordances. Device
 * class doesn't change at runtime, so this is evaluated once.
 */
export function useTouch(): boolean {
  return useState(() => {
    if (typeof window === "undefined") return false
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false
    const ua = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")
    return coarse || ua
  })[0]
}

"use client";
import {useEffect, useState} from "react";

export default function ClientOnly() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    console.log("mountedd");
    setMounted(true);
    const el = document.getElementById('app-body')
    document.body.style.alignItems='flex-start'
    if (el) {

      el.style.display = "block";
      el.classList.add("loaded");
    }
  }, []);

  return mounted ? null :

    <div className="app-spinner" />


}


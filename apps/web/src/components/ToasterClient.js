"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("react-hot-toast").then((m) => m.Toaster),
  { ssr: false }
);

export default function ToasterClient() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { borderRadius: "10px", fontSize: "14px" },
      }}
    />
  );
}

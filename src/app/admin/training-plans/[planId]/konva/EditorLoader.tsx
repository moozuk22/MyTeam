"use client";
import dynamic from "next/dynamic";
import { Waypoints } from "lucide-react";
import { SkeletonLine } from "@/app/admin/members/_components/FinanceSkeleton";
import type { EditorProps } from "./Editor";
import "./konva.css";
function EditorSkeleton() {
  return (
    <main className="ke-page">
      <div className="ke-rail" aria-hidden="true">
        <span className="ke-brand" />
      </div>
      <div
        className="ke-inner"
        role="status"
        aria-label="Зареждане"
        aria-busy="true"
      >
        <header className="ke-header">
          <div className="ke-header-bar">
            <h1><Waypoints size={24} aria-hidden="true" />Редактор на план</h1>
          </div>
        </header>
        <div className="ke-workspace" aria-hidden="true">
          <div className="ke-layout">
            <div className="ke-pitch-area">
              <div className="ke-canvas-toolbar">
                <SkeletonLine />
                <SkeletonLine />
              </div>
              <div className="ke-pitch-frame">
                <div className="ke-pitch-scroll">
                  <div className="ke-skeleton-pitch" />
                </div>
              </div>
            </div>
            <div className="ke-sidebar">
              <div className="ke-panel-switch">
                <SkeletonLine />
                <SkeletonLine />
              </div>
              <div className="ke-skeleton-tools">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonLine key={i} />
                ))}
              </div>
              <div className="ke-mode"><SkeletonLine wide /></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: EditorSkeleton,
});
export default function EditorLoader(props: EditorProps) {
  return <Editor {...props} />;
}

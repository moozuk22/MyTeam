"use client";
import dynamic from "next/dynamic";
import { SkeletonLine } from "@/app/admin/members/_components/FinanceSkeleton";
import type { EditorProps } from "./Editor";
import "./konva.css";
function EditorSkeleton() {
  return (
    <main className="ke-page">
      <div
        className="ke-inner"
        role="status"
        aria-label="Зареждане"
        aria-busy="true"
      >
        <header className="ke-header">
          <h1>Редактор на упражнение</h1>
        </header>
        <div className="ke-workspace" aria-hidden="true">
          <div className="ke-layout">
            <div className="ke-sidebar">
              <div className="ke-skeleton-tools">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonLine key={i} />
                ))}
              </div>
            </div>
            <div className="ke-pitch-area">
              <div className="ke-skeleton-pitch" />
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

"use client";
import dynamic from "next/dynamic";
import { SkeletonLine } from "@/app/admin/members/_components/FinanceSkeleton";
import type { EditorProps } from "./Editor";
import "./konva.css";
function EditorSkeleton() {
  return (
    <main className="ke-page">
      <h1>Редактор на упражнение</h1>
      <div
        className="ke-skeleton"
        role="status"
        aria-label="Зареждане"
        aria-busy="true"
      >
        <div aria-hidden="true">
          <SkeletonLine wide />
          <div className="ke-skeleton-tools">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
          <div className="ke-skeleton-pitch" />
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

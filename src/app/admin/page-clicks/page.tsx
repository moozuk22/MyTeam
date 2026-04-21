import type { Metadata } from "next";
import PageClicksClient from "./page.client";

export const metadata: Metadata = {
  title: "Кликове на началната страница | Admin",
};

export default function PageClicksPage() {
  return <PageClicksClient />;
}

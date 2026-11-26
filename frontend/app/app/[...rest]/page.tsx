import { notFound } from "next/navigation";

/** An unknown path under /app is the Not_Found_Page with HTTP 404 (PATH-11, SLUG-11). */
export default function UnknownAppPath() {
  notFound();
}

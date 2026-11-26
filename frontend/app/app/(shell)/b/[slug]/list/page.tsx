import { boardMetadata, renderBoardPage, type BoardParams } from "@/lib/board-page";

export const generateMetadata = (props: BoardParams) => boardMetadata(props, "list");

export default function Page(props: BoardParams) {
  return renderBoardPage(props, "list");
}

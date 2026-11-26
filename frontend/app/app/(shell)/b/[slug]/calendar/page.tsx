import { boardMetadata, renderBoardPage, type BoardParams } from "@/lib/board-page";

export const generateMetadata = (props: BoardParams) => boardMetadata(props, "calendar");

export default function Page(props: BoardParams) {
  return renderBoardPage(props, "calendar");
}

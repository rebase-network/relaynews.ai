import * as Shared from "../shared";
import { SubmitForm } from "../features/submit/submit-form";
import { SubmitHero } from "../features/submit/submit-hero";
import { useSubmitForm } from "../features/submit/use-submit-form";

const { usePageMetadata } = Shared;

export function SubmitPage() {
  const controller = useSubmitForm();

  usePageMetadata({
    title: "提交站点信息｜relaynew.ai",
    description: "提交站点基础信息、联系方式、支持模型与价格信息进入审核队列，完成初始测试；赞助流程与评测排名逻辑分离。",
    canonicalPath: "/submit",
  });

  return (
    <section className="submit-page-shell">
      <SubmitHero />
      <SubmitForm controller={controller} />
    </section>
  );
}

import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import TalkForm from "../components/TalkForm";
import { ButtonLink, PageHeader } from "../theme";

export default function TalkNewPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl">
      <ButtonLink to="/talks" variant="ghost" className="-ml-4 mb-5">
        <ArrowLeft size={15} />
        My talks
      </ButtonLink>
      <PageHeader
        eyebrow="Your personal purpleroom"
        title="A new idea deserves a stage."
      />
      <TalkForm
        onSaved={(paper) => navigate(`/talks/${paper.id}`, { replace: true })}
      />
    </div>
  );
}

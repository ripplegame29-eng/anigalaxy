import type { Metadata } from "next";
import { QuizView } from "@/components/quiz/QuizView";

export const metadata: Metadata = {
  title: "Квиз",
  description:
    "Квиз AniGalaxy: угадай тайтл по кадру или по песне из opening'а — 5 вопросов в раунде. Проходи раунды и забирай XP и анимокоины.",
};

export default function QuizPage() {
  return <QuizView />;
}

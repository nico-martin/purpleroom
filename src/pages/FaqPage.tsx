import { ChevronDown } from "lucide-react";

import AppFooter from "../components/AppFooter";
import { Brand, ButtonLink, Card, ColorSchemeControl } from "../theme";

const questions = [
  {
    question: "What is purpleroom?",
    answer:
      "purpleroom is a members-only space for conference speakers to find their next stage, keep track of talk proposals, and see where their friends are heading. Think of it as your private speaking notebook, with a crew to swap notes with.",
  },
  {
    question: "Who is it for?",
    answer:
      "It's for conference speakers—whether you're putting together your first proposal or already speaking regularly. Use it to discover opportunities, organise your talks, and learn from friends' experiences. You don't need an accepted talk or an invitation to join.",
  },
  {
    question: "What can I do in the room?",
    answer:
      "Explore an admin-maintained conference catalog with event dates, locations, topic tags, and calls for proposals (CFPs). Keep a reusable talk library, track submission progress, mark events Going or Maybe, and share practical speaker reviews with your friends.",
  },
  {
    question: "How do I join?",
    answer:
      "Enter your email on the sign-in screen and paste the six-digit code from your inbox into the same screen. No password or signup invitation is needed. Codes work once and expire after 15 minutes. On your first sign-in, choose a display name before entering the room. Your email isn't shown to other members.",
  },
  {
    question: "Who can see my talks and submissions?",
    answer:
      "Your talk titles, proposal content, private notes, submission dates, and outcomes are yours alone—even admins cannot view them through the app. Accepted friends can see that you've submitted to an edition, but not which talks, how many, or the results. These are app access rules, not a promise that the hosting operator cannot access server storage.",
  },
  {
    question: "What is my crew, and what do we share?",
    answer:
      "Your crew is made up of mutually accepted friends. Find people in The crew → All members and send a request. Once accepted, you can see each other's Going/Maybe plans, speaker reviews, and submission participation. Simply being in the member directory doesn't grant this access. Unfriending ends friendship-based access.",
  },
  {
    question: "Does adding a talk submit it to a conference?",
    answer:
      "No. purpleroom tracks your plans and outcomes; you still submit through the conference's own CFP service. If the topic isn't decided yet, choose “Topic to be agreed” and attach a talk later. Going and Maybe are separate choices: an acceptance or rejection never changes your attendance plans automatically.",
  },
  {
    question: "Is purpleroom still in beta?",
    answer:
      "Yes—this is v0 / early beta, so expect bugs and rough edges. purpleroom is open source, and your feedback helps shape what comes next. The GitHub link in the footer takes you to the project.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-8 sm:px-12">
      <header className="flex items-center justify-between gap-4">
        <Brand />
        <ColorSchemeControl compact />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 py-14 sm:py-20">
        <p className="mb-4 font-mono text-xs tracking-widest text-purple">
          {"{ where speakers swap notes }"}
        </p>
        <h1 className="text-4xl tracking-tight sm:text-5xl">
          A little about the room.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          New here? Start with the basics. A few answers about purpleroom, who
          it's for, and what stays private.
        </p>
        <Card className="mt-10 divide-y divide-border">
          {questions.map(({ question, answer }) => (
            <details key={question} className="group px-5 sm:px-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold text-ink">
                {question}
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-purple group-open:rotate-180"
                />
              </summary>
              <p className="pb-6 text-sm leading-relaxed text-muted">
                {answer}
              </p>
            </details>
          ))}
        </Card>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <ButtonLink to="/login" variant="primary">
            Join or sign in
          </ButtonLink>
          <p className="text-sm text-muted">
            No password. No invitation needed.
          </p>
        </div>
      </main>
      <AppFooter showVersion />
    </div>
  );
}

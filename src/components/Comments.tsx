import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import { relativeTime } from "../lib/format";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Notice,
  SectionHeader,
  Textarea,
} from "../theme";
import type { Comment } from "../types";

interface CommentsProps {
  comments: Comment[];
  target: { conference_id: number } | { edition_id: number };
  onSaved: () => void;
  className?: string;
}
export default function Comments({
  comments,
  target,
  onSaved,
  className = "",
}: CommentsProps) {
  const { user } = useSession();
  const [text, setText] = useState("");
  const { busy, error, run } = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () => api("/comments", { method: "POST", body: { ...target, text } }),
      () => {
        setText("");
        onSaved();
      }
    );
  }
  return (
    <section className={className}>
      <SectionHeader title="Notes from the crew" count={comments.length} />
      <Card>
        {comments.length ? (
          <div className="divide-y divide-divider">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-5 sm:p-6">
                <Avatar
                  name={comment.user.name}
                  src={comment.user.avatar_url}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold">
                      {comment.user.name}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {relativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                    {comment.text}
                  </p>
                </div>
                {comment.user_id === user.id && (
                  <Button
                    variant="ghost"
                    aria-label="Delete comment"
                    disabled={busy}
                    className="size-11 p-0"
                    onClick={() => {
                      if (confirm("Delete your comment?"))
                        run(
                          () =>
                            api(`/comments/${comment.id}`, {
                              method: "DELETE",
                            }),
                          onSaved
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Start a conversation."
            description="Questions, tips, travel plans. This is a good place for all of them."
            icon={<MessageSquare size={22} strokeWidth={1.5} />}
          />
        )}
        <form onSubmit={submit} className="border-t border-divider p-5 sm:p-6">
          <div className="flex gap-3">
            <Avatar name={user.name} src={user.avatar_url} />
            <div className="flex-1 space-y-3">
              <Textarea
                aria-label="Your comment"
                rows={3}
                placeholder="Something the crew should know?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
              {error && <Notice tone="error">{error}</Notice>}
              <div className="flex justify-end">
                <Button type="submit" loading={busy} disabled={!text.trim()}>
                  <Send size={14} />
                  Leave a note
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Card>
    </section>
  );
}

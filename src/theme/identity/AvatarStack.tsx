import type { User } from "../../types";
import cn from "../../utils/classnames";
import { Avatar } from "../index";

interface AvatarStackProps {
  users: User[];
  max?: number;
  className?: string;
}
export default function AvatarStack({
  users,
  max = 4,
  className = "",
}: AvatarStackProps) {
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {users.slice(0, max).map((user) => (
        <Avatar
          key={user.id}
          name={user.name}
          src={user.avatar_url}
          size="sm"
          className="ring-2 ring-surface"
        />
      ))}
      {users.length > max && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-divider text-xs ring-2 ring-surface">
          +{users.length - max}
        </span>
      )}
    </div>
  );
}

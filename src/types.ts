import type { REVIEW_TAGS, SUBMISSION_STATUSES } from "./lib/constants";
import type { ProfileLinks } from "./lib/profile";

export type ReviewTag = keyof typeof REVIEW_TAGS;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export interface User {
  id: number;
  name: string;
  avatar_url: string | null;
  email?: string;
}
export interface Account extends User, ProfileLinks {
  email: string;
  role: "member" | "admin";
  profile_complete: number;
}
export interface Conference {
  id: number;
  name: string;
  tags: string[];
  website: string | null;
  logo_url: string | null;
  description: string | null;
  created_by: number | User | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface ConferenceSummary extends Conference {
  has_open_cfp: boolean;
  review_count: number;
  tag_counts: Partial<Record<ReviewTag, number>>;
  next_edition: Edition | null;
  would_submit_again: { yes: number; no: number };
}
export interface ConferenceDetail extends ConferenceSummary {
  editions: Edition[];
  reviews: Review[];
}
export interface Edition {
  id: number;
  conference_id: number;
  title: string;
  /** Legacy metadata, derived from dates; never appended to the edition title. */
  year: number;
  city: string | null;
  country: string | null;
  online: number;
  starts_on: string | null;
  ends_on: string | null;
  starts_timezone: string | null;
  ends_timezone: string | null;
  website: string | null;
  cfp_url: string | null;
  cfp_opens_on: string | null;
  cfp_closes_on: string | null;
  cfp_opens_timezone: string | null;
  cfp_closes_timezone: string | null;
  cfp_closes_time: string | null;
  cfp_opens_at: string | null;
  cfp_closes_at: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface People {
  going: User[];
  maybe: User[];
}
export interface EditionDetail extends Edition, People {
  conference: ConferenceSummary;
  submitted_friends: User[];
  attendance: Attendance[];
  my_submissions: Submission[];
}
export interface Review {
  id: number;
  conference_id: number;
  user_id: number;
  user: User;
  tags: ReviewTag[];
  would_submit_again: number | null;
  text: string | null;
  updated_at: string;
}
export interface Paper {
  id: number;
  owner_id: number;
  title: string;
  abstract: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  submissions: Submission[];
}
export interface Submission {
  id: number;
  paper_id: number | null;
  edition_id: number;
  status: SubmissionStatus;
  abstract_override: string | null;
  hide_title: number;
  submitted_on: string | null;
  submitted_timezone: string | null;
  notes: string | null;
  updated_at: string;
  paper_title?: string | null;
  edition?: Edition;
  conference?: Conference;
}
export interface Attendance {
  id: number;
  edition_id: number;
  user_id: number;
  status: "maybe" | "going";
  user: User;
}
export interface Cfp {
  edition: Edition;
  conference: ConferenceSummary;
  days_left: number;
  submitters: User[];
  my_submissions: Submission[];
}
export interface Upcoming extends People {
  edition: Edition;
  conference: ConferenceSummary;
}
export interface Activity {
  type: string;
  at: string;
  user: User;
  summary: string;
  link: string;
}
export interface Dashboard {
  open_cfps: Cfp[];
  upcoming: Upcoming[];
  recent_activity: Activity[];
}
export interface Me {
  user: Account;
}
export type Relationship = "self" | "none" | "incoming" | "outgoing" | "friend";
export interface Member extends User {
  relationship: Relationship;
}
export interface CrewRequests {
  incoming: User[];
  outgoing: User[];
  blocked: User[];
}
export interface AdminUser extends User {
  role: "member" | "admin";
  profile_complete: number;
  suspended: number;
}

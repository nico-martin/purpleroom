import type { REVIEW_TAGS, SUBMISSION_STATUSES } from "./lib/constants";

export type ReviewTag = keyof typeof REVIEW_TAGS;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export interface User {
  id: number;
  name: string;
  avatar_url: string | null;
  email?: string;
}
export interface Conference {
  id: number;
  name: string;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  created_by: number | User;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface ConferenceSummary extends Conference {
  review_count: number;
  tag_counts: Partial<Record<ReviewTag, number>>;
  next_edition: Edition | null;
  would_submit_again: { yes: number; no: number };
}
export interface ConferenceDetail extends ConferenceSummary {
  editions: Edition[];
  reviews: Review[];
  comments: Comment[];
}
export interface Edition {
  id: number;
  conference_id: number;
  year: number;
  city: string | null;
  country: string | null;
  online: number;
  starts_on: string | null;
  ends_on: string | null;
  website: string | null;
  cfp_url: string | null;
  cfp_opens_on: string | null;
  cfp_closes_on: string | null;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface People {
  speaking: { user: User; status: SubmissionStatus }[];
  going: User[];
  maybe: User[];
}
export interface EditionDetail extends Edition, People {
  conference: ConferenceSummary;
  submissions: PublicSubmission[];
  attendance: Attendance[];
  comments: Comment[];
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
  paper_id: number;
  edition_id: number;
  status: SubmissionStatus;
  abstract_override: string | null;
  hide_title: number;
  submitted_on: string | null;
  updated_at: string;
  paper_title?: string;
  edition?: Edition;
  conference?: Conference;
}
export interface PublicSubmission {
  id: number;
  status: SubmissionStatus;
  user: User;
  paper_title: string | null;
  updated_at: string;
}
export interface Attendance {
  id: number;
  edition_id: number;
  user_id: number;
  status: "maybe" | "going";
  user: User;
}
export interface Comment {
  id: number;
  user_id: number;
  user: User;
  conference_id: number | null;
  edition_id: number | null;
  text: string;
  created_at: string;
}
export interface Invite {
  id: number;
  email: string | null;
  invited_by: User;
  expires_at: string;
  created_at: string;
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
  user: User;
  cal_url: string;
}

export const REVIEW_TAGS = {
  covers_travel: "Covers travel",
  covers_hotel: "Covers hotel",
  pays_speakers: "Pays an honorarium",
  great_speaker_care: "Great speaker care",
  speaker_dinner: "Speaker dinner / social",
  recorded: "Talks recorded & published",
  big_audience: "Big audience (500+)",
  senior_audience: "Experienced audience",
  transparent_cfp: "Transparent CFP / feedback",
  anonymous_review: "Anonymous CFP review",
  know_organizers: "I know the organizers",
  spoke_there: "I've spoken there",
  attended_there: "I've attended",
  heard_good_things: "Heard good things",
  disorganized: "Disorganized",
  poor_communication: "Poor communication",
} as const;
export const SUBMISSION_STATUSES = [
  "interested",
  "submitted",
  "accepted",
  "rejected",
  "waitlisted",
  "confirmed",
  "declined",
  "attended",
] as const;

// Keep the historical status in the data model without offering it for new choices.
export const SUBMISSION_STATUS_OPTIONS = SUBMISSION_STATUSES.filter(
  (status) => status !== "attended"
);

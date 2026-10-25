<?php
if (!defined('GREEN_ROOM')) exit;
const REVIEW_TAGS = [
 'covers_travel' => 'Covers travel', 'covers_hotel' => 'Covers hotel', 'pays_speakers' => 'Pays an honorarium',
 'great_speaker_care' => 'Great speaker care', 'speaker_dinner' => 'Speaker dinner / social',
 'recorded' => 'Talks recorded & published', 'big_audience' => 'Big audience (500+)',
 'senior_audience' => 'Experienced audience', 'transparent_cfp' => 'Transparent CFP / feedback',
 'anonymous_review' => 'Anonymous CFP review', 'know_organizers' => 'I know the organizers',
 'spoke_there' => "I've spoken there", 'attended_there' => "I've attended", 'heard_good_things' => 'Heard good things',
 'disorganized' => 'Disorganized', 'poor_communication' => 'Poor communication',
];
const PAPER_AUDIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'all'];
const PAPER_FORMATS = ['talk', 'lightning', 'workshop', 'keynote', 'panel', 'other'];
const SUBMISSION_STATUSES = ['interested', 'submitted', 'accepted', 'rejected', 'waitlisted', 'confirmed', 'declined', 'attended'];

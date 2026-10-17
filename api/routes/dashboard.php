<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/dashboard', function () {
    $today = gmdate('Y-m-d'); $uid = require_login()['id'];
    $open = all('SELECT e.* FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND e.cfp_closes_on>=? ORDER BY e.cfp_closes_on', [$today]);
    $open = array_map(function ($e) use ($today, $uid) {
        $submitters = all('SELECT DISTINCT u.id,u.name,u.avatar_url FROM submissions s JOIN papers p ON p.id=s.paper_id JOIN users u ON u.id=p.owner_id WHERE s.edition_id=?', [$e['id']]);
        return ['edition' => $e, 'conference' => conference_summary(conference((int) $e['conference_id'])), 'days_left' => (int) (new DateTimeImmutable($today))->diff(new DateTimeImmutable($e['cfp_closes_on']))->format('%a'), 'submitters' => $submitters, 'my_submissions' => all('SELECT s.*,p.title AS paper_title FROM submissions s JOIN papers p ON p.id=s.paper_id WHERE s.edition_id=? AND p.owner_id=?', [$e['id'], $uid])];
    }, $open);
    $upcoming = array_map(fn($e) => ['edition' => $e, 'conference' => conference_summary(conference((int) $e['conference_id'])), ...people_for((int) $e['id'])], all('SELECT e.* FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND e.starts_on>=? ORDER BY e.starts_on LIMIT 20', [$today]));
    $editionLabel = "COALESCE(NULLIF(e.title,''),c.name)";
    $commentEditionLabel = str_replace('c.name', 'ec.name', $editionLabel);
    $activity = all("SELECT 'conference' AS type, c.created_at AS at, c.created_by AS user_id, 'added ' || c.name AS summary, '/conferences/' || c.id AS link FROM conferences c WHERE c.deleted_at IS NULL
      UNION ALL SELECT 'edition',e.created_at,e.created_by,'added ' || $editionLabel,'/editions/' || e.id FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL
      UNION ALL SELECT 'submission_status',s.updated_at,p.owner_id,s.status || ' a talk for ' || $editionLabel,'/editions/' || e.id FROM submissions s JOIN papers p ON p.id=s.paper_id JOIN editions e ON e.id=s.edition_id JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL
      UNION ALL SELECT 'review',r.updated_at,r.user_id,'shared a speaker take on ' || c.name,'/conferences/' || c.id FROM reviews r JOIN conferences c ON c.id=r.conference_id WHERE c.deleted_at IS NULL
      UNION ALL SELECT 'comment',cm.created_at,cm.user_id,'left a note on ' || CASE WHEN cm.edition_id IS NULL THEN c.name ELSE $commentEditionLabel END, CASE WHEN cm.edition_id IS NULL THEN '/conferences/' || cm.conference_id ELSE '/editions/' || cm.edition_id END FROM comments cm LEFT JOIN conferences c ON c.id=cm.conference_id LEFT JOIN editions e ON e.id=cm.edition_id LEFT JOIN conferences ec ON ec.id=e.conference_id WHERE (c.id IS NOT NULL AND c.deleted_at IS NULL) OR (e.id IS NOT NULL AND e.deleted_at IS NULL AND ec.deleted_at IS NULL)
      ORDER BY at DESC LIMIT 10");
    json_response(['open_cfps' => $open, 'upcoming' => $upcoming, 'recent_activity' => array_map(function ($a) { $a['user'] = user_by_id((int) $a['user_id']); unset($a['user_id']); return $a; }, $activity)]);
});

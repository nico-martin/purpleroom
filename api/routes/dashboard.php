<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/dashboard', function () {
    $today=gmdate('Y-m-d'); $uid=(int)require_login()['id'];
    $open=all("SELECT e.* FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND ".cfp_open_sql('e')." ORDER BY COALESCE(e.cfp_closes_at,e.cfp_closes_on||'T23:59:59Z'),e.id",cfp_open_params());
    $open=array_map(function($e) use($uid) {
        return ['edition'=>$e,'conference'=>conference_summary(conference((int)$e['conference_id'])),'days_left'=>cfp_days_left($e),'submitters'=>submitted_friends((int)$e['id']),'my_submissions'=>all('SELECT s.*,p.title AS paper_title FROM submissions s LEFT JOIN papers p ON p.id=s.paper_id WHERE s.edition_id=? AND s.owner_id=?',[$e['id'],$uid])];
    },$open);
    $ids=visible_user_ids(); $scope=id_placeholders($ids);
    $upcoming=all("SELECT e.* FROM editions e JOIN conferences c ON c.id=e.conference_id WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND COALESCE(e.ends_on,e.starts_on)>=? AND EXISTS(SELECT 1 FROM attendance a WHERE a.edition_id=e.id AND a.user_id IN ($scope)) ORDER BY e.starts_on,e.id LIMIT 20",[$today,...$ids]);
    $upcoming=array_map(fn($e)=>['edition'=>$e,'conference'=>conference_summary(conference((int)$e['conference_id'])),...people_for((int)$e['id'])],$upcoming);
    // Only catalog additions and viewer-visible reviews: never submission outcomes or comments.
    $activity=all("SELECT 'conference' AS type,c.created_at AS at,c.created_by AS user_id,'added '||c.name AS summary,'/conferences/'||c.id AS link FROM conferences c JOIN users u ON u.id=c.created_by WHERE c.deleted_at IS NULL AND u.suspended=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=?))
      UNION ALL SELECT 'edition',e.created_at,e.created_by,'added '||e.title,'/editions/'||e.id FROM editions e JOIN conferences c ON c.id=e.conference_id JOIN users u ON u.id=e.created_by WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL AND u.suspended=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=?))
      UNION ALL SELECT 'review',r.updated_at,r.user_id,'shared a speaker take on '||c.name,'/conferences/'||c.id FROM reviews r JOIN conferences c ON c.id=r.conference_id WHERE c.deleted_at IS NULL AND r.user_id IN ($scope)
      ORDER BY at DESC LIMIT 10",[$uid,$uid,$uid,$uid,...$ids]);
    json_response(['open_cfps'=>$open,'upcoming'=>$upcoming,'recent_activity'=>array_map(function($a){$a['user']=user_by_id((int)$a['user_id']);unset($a['user_id']);return $a;},$activity)]);
});

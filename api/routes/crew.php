<?php
if (!defined('GREEN_ROOM')) exit;

route('GET', '/crew', function () {
    $viewer = (int) require_login()['id'];
    $requests = all("SELECT u.id,u.name,u.avatar_url,f.requested_by FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END WHERE (f.user_low=? OR f.user_high=?) AND f.status='pending' AND u.suspended=0 AND u.profile_complete=1 ORDER BY f.created_at DESC", [$viewer,$viewer,$viewer]);
    $blocked = all('SELECT u.id,u.name,u.avatar_url FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=? ORDER BY u.name', [$viewer]);
    json_response(['incoming'=>array_values(array_map('public_user', array_filter($requests,fn($r)=>$r['requested_by']!==$viewer))), 'outgoing'=>array_values(array_map('public_user', array_filter($requests,fn($r)=>$r['requested_by']===$viewer))), 'blocked'=>$blocked]);
});
route('POST', '/crew/{id}/request', function ($p) {
    $viewer = (int) require_login()['id']; $id = (int)$p['id'];
    if ($id === $viewer) fail(422, 'validation', 'You cannot request yourself.');
    if (!take_rate_limit('crew:' . $viewer, 30, 3600)) fail(429, 'rate_limited', 'Too many crew requests. Try again later.');
    db()->exec('BEGIN IMMEDIATE');
    try {
        member_target($id);
        $low=min($viewer,$id); $high=max($viewer,$id);
        $f=one('SELECT * FROM friendships WHERE user_low=? AND user_high=?',[$low,$high]);
        if (!$f) insert('friendships',['user_low'=>$low,'user_high'=>$high,'requested_by'=>$viewer,'status'=>'pending','created_at'=>now(),'updated_at'=>now()]);
        elseif ($f['status']==='pending' && $f['requested_by']!==$viewer) query("UPDATE friendships SET status='accepted',updated_at=? WHERE user_low=? AND user_high=?",[now(),$low,$high]);
        db()->exec('COMMIT');
    } catch (Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(['relationship'=>friendship_state($id)]);
});
route('POST', '/crew/{id}/accept', function ($p) {
    $viewer=(int)require_login()['id']; $id=(int)$p['id'];
    db()->exec('BEGIN IMMEDIATE');
    try {
        member_target($id);
        $f=one("SELECT * FROM friendships WHERE user_low=? AND user_high=? AND status='pending' AND requested_by=?",[min($viewer,$id),max($viewer,$id),$id]);
        if (!$f) { db()->exec('ROLLBACK'); fail(404,'not_found','Incoming request not found.'); }
        query("UPDATE friendships SET status='accepted',updated_at=? WHERE user_low=? AND user_high=?",[now(),min($viewer,$id),max($viewer,$id)]);
        db()->exec('COMMIT');
    } catch(Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(['relationship'=>'friend']);
});
// Either participant may leave a friendship, decline an incoming request, or cancel an outgoing one.
route('DELETE', '/crew/{id}', function ($p) {
    $viewer=(int)require_login()['id']; $id=(int)$p['id'];
    query('DELETE FROM friendships WHERE user_low=? AND user_high=?',[min($viewer,$id),max($viewer,$id)]);
    json_response(null,204);
});
route('POST', '/crew/{id}/block', function ($p) {
    $viewer=(int)require_login()['id']; $id=(int)$p['id'];
    if ($id===$viewer) fail(422,'validation','You cannot block yourself.');
    db()->exec('BEGIN IMMEDIATE');
    try {
        if (!one('SELECT id FROM users WHERE id=?',[$id])) { db()->exec('ROLLBACK'); fail(404,'not_found','Member not found.'); }
        query('INSERT OR IGNORE INTO blocks(user_id,blocked_id,created_at) VALUES(?,?,?)',[$viewer,$id,now()]);
        query('DELETE FROM friendships WHERE user_low=? AND user_high=?',[min($viewer,$id),max($viewer,$id)]);
        db()->exec('COMMIT');
    } catch(Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(null,204);
});
route('DELETE', '/crew/{id}/block', function ($p) {
    query('DELETE FROM blocks WHERE user_id=? AND blocked_id=?',[require_login()['id'],(int)$p['id']]);
    json_response(null,204);
});

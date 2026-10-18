<?php
if (!defined('GREEN_ROOM')) exit;
route('GET', '/admin/users', function () {
    require_admin();
    json_response(all('SELECT id,name,avatar_url,role,suspended,profile_complete FROM users ORDER BY name,id'));
});
route('PATCH', '/admin/users/{id}', function ($p) {
    require_admin(); $input=body(); $data=[];
    if (array_key_exists('role',$input)) {
        if (!in_array($input['role'],['member','admin'],true)) fail(422,'validation','Choose member or admin.');
        $data['role']=$input['role'];
    }
    if (array_key_exists('suspended',$input)) {
        if (!in_array($input['suspended'],[0,1,false,true],true)) fail(422,'validation','Invalid suspension value.');
        $data['suspended']=(int)$input['suspended'];
    }
    db()->exec('BEGIN IMMEDIATE');
    try {
        require_admin();
        $user=one('SELECT * FROM users WHERE id=?',[(int)$p['id']]);
        if (!$user) { db()->exec('ROLLBACK'); fail(404,'not_found','Member not found.'); }
        $merged=[...$user,...$data];
        if ($user['role']==='admin' && !$user['suspended'] && ($merged['role']!=='admin' || $merged['suspended']) && (int)one("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND suspended=0")['n']<=1) {
            db()->exec('ROLLBACK'); fail(409,'last_admin','The last active admin cannot be demoted or suspended.');
        }
        if (isset($data['suspended']) && $data['suspended']!==$user['suspended']) $data['session_version']=$user['session_version']+1;
        update('users',(int)$user['id'],$data);
        db()->exec('COMMIT');
    } catch(Throwable $error) { db()->exec('ROLLBACK'); throw $error; }
    json_response(one('SELECT id,name,avatar_url,role,suspended,profile_complete FROM users WHERE id=?',[$user['id']]));
});

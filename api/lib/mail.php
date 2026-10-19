<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

class MailDeliveryException extends RuntimeException {}

function login_mail_content(string $code): array {
    if (!preg_match('/^[0-9]{6}$/D', $code)) throw new MailDeliveryException('Invalid sign-in code.');
    $text = "purpleroom\n{ where speakers swap notes }\n\nYour sign-in code:\n\n$code\n\nCopy this code and paste it into the login screen in the browser where you requested it. You don't need to open a link.\n\nThis code expires in 15 minutes and can only be used once. Never share it. If you didn't request it, you can safely ignore this email.\n\nA project by Nico Martin — https://nico.dev\nOpen source — https://github.com/nico-martin/purpleroom/\n";
    $html = <<<HTML
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your purpleroom sign-in code</title></head>
<body style="margin:0;padding:0;background-color:#f6f3f8;color:#302638;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your one-time sign-in code. Good for 15 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f3f8;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e7dfed;border-top:5px solid #663399;border-radius:16px;">
<tr><td style="padding:32px 32px 16px;font-size:24px;font-weight:bold;">purpleroom<span style="color:#663399;">.</span></td></tr>
<tr><td style="padding:8px 32px 32px;">
<h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;">Your sign-in code.</h1>
<p style="margin:0 0 24px;color:#6b5c78;font-size:16px;line-height:1.6;">{ where speakers swap notes }</p>
<p style="margin:0;padding:20px;background-color:#eee5f5;border-radius:8px;color:#663399;font-family:monospace;font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;">$code</p>
<p style="margin:24px 0 0;color:#6b5c78;font-size:16px;line-height:1.6;">Copy this code and paste it into the login screen in the browser where you requested it. No link to open.</p>
<p style="margin:24px 0 0;color:#6b5c78;font-size:14px;line-height:1.6;">This code expires in <strong>15 minutes</strong> and can only be used once. Never share it. If you didn't request it, you can safely ignore this email.</p>
</td></tr></table>
<p style="max-width:560px;margin:20px 0 0;color:#6b5c78;font-size:12px;line-height:1.8;">A project by <a href="https://nico.dev" style="color:#663399;">Nico Martin</a> · <a href="https://github.com/nico-martin/purpleroom/" style="color:#663399;">Open source on GitHub</a></p>
</td></tr></table></body></html>
HTML;
    return ['text'=>$text,'html'=>$html];
}

function mail_sender(string $from): array {
    if (preg_match('/[\x00-\x1f\x7f]/',$from)) throw new MailDeliveryException('Invalid mail sender configuration.');
    $name = ''; $address = trim($from);
    if (preg_match('/^(.+?)\s*<([^<>]+)>$/D',$address,$parts)) { $name=trim($parts[1]); $address=$parts[2]; }
    if (!filter_var($address,FILTER_VALIDATE_EMAIL)) throw new MailDeliveryException('Invalid mail sender configuration.');
    return ['address'=>$address,'header'=>$name === '' ? $address : '=?UTF-8?B?' . base64_encode($name) . '?= <' . $address . '>'];
}

function compose_login_mail(string $email, string $code, string $from): array {
    if (preg_match('/[\x00-\x1f\x7f]/',$email) || !filter_var($email,FILTER_VALIDATE_EMAIL)) throw new MailDeliveryException('Invalid email recipient.');
    $sender=mail_sender($from); $content=login_mail_content($code);
    $boundary='purpleroom-' . bin2hex(random_bytes(24));
    $headers=[
        'From'=>$sender['header'], 'MIME-Version'=>'1.0',
        'Content-Type'=>'multipart/alternative; boundary="' . $boundary . '"',
        'Date'=>gmdate('D, d M Y H:i:s +0000'),
        'Message-ID'=>'<' . bin2hex(random_bytes(16)) . '@' . substr(strrchr($sender['address'],'@'),1) . '>',
        'Auto-Submitted'=>'auto-generated', 'X-Auto-Response-Suppress'=>'All',
    ];
    $body='';
    foreach (['text'=>'text/plain','html'=>'text/html'] as $key=>$type) {
        $body.='--' . $boundary . "\r\nContent-Type: $type; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($content[$key]),76,"\r\n") . "\r\n";
    }
    $body.='--' . $boundary . "--\r\n";
    $subject='Your purpleroom sign-in code';
    $lines=['To: ' . $email,'Subject: ' . $subject];
    foreach ($headers as $key=>$value) $lines[]=$key . ': ' . $value;
    return ['subject'=>$subject,'headers'=>$headers,'body'=>$body,'message'=>implode("\r\n",$lines) . "\r\n\r\n" . $body,'sender'=>$sender['address']];
}

function send_smtp_mail(string $email, array $message, array $settings): void {
    if (!function_exists('curl_init') || !defined('CURLPROTO_SMTP') || !defined('CURLPROTO_SMTPS')) throw new MailDeliveryException('SMTP requires PHP cURL with SMTP and TLS support.');
    $host=$settings['smtp_host'] ?? ''; $user=$settings['smtp_username'] ?? ''; $password=$settings['smtp_password'] ?? '';
    foreach ([$host,$user,$password] as $value) if (!is_string($value) || $value==='' || preg_match('/[\x00-\x1f\x7f]/',$value)) throw new MailDeliveryException('Incomplete or invalid SMTP configuration.');
    $domain = strlen($host)<=253 && array_reduce(explode('.',$host),fn($valid,$label)=>$valid && (bool)preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iD',$label),true);
    $ipv6 = str_starts_with($host,'[') && str_ends_with($host,']') && filter_var(substr($host,1,-1),FILTER_VALIDATE_IP,FILTER_FLAG_IPV6);
    if (!$domain && !$ipv6) throw new MailDeliveryException('Invalid SMTP host configuration.');
    $encryption=$settings['smtp_encryption'] ?? 'tls';
    $port=filter_var($settings['smtp_port'] ?? ($encryption==='ssl'?465:587),FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>65535]]);
    if (!in_array($encryption,['tls','ssl'],true) || $port===false) throw new MailDeliveryException('Invalid SMTP encryption or port configuration.');
    $stream=fopen('php://temp','w+b');
    if ($stream===false) throw new MailDeliveryException('Could not prepare SMTP delivery.');
    $curl=curl_init();
    try {
        if (fwrite($stream,$message['message'])!==strlen($message['message'])) throw new MailDeliveryException('Could not prepare SMTP delivery.');
        rewind($stream);
        $options=[
            CURLOPT_URL=>($encryption==='ssl'?'smtps':'smtp') . '://' . $host . ':' . $port,
            CURLOPT_PROTOCOLS=>CURLPROTO_SMTP|CURLPROTO_SMTPS,
            CURLOPT_USERNAME=>$user, CURLOPT_PASSWORD=>$password,
            CURLOPT_USE_SSL=>CURLUSESSL_ALL, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
            CURLOPT_SSLVERSION=>CURL_SSLVERSION_TLSv1_2,
            CURLOPT_CONNECTTIMEOUT=>10, CURLOPT_TIMEOUT=>30,
            CURLOPT_MAIL_FROM=>$message['sender'], CURLOPT_MAIL_RCPT=>[$email],
            CURLOPT_UPLOAD=>true, CURLOPT_INFILE=>$stream, CURLOPT_INFILESIZE=>strlen($message['message']),
            CURLOPT_RETURNTRANSFER=>true, CURLOPT_PROXY=>'',
        ];
        // Optional private CA bundle for locally configured SMTP servers; verification stays enabled.
        if (!empty($settings['smtp_ca_file'])) $options[CURLOPT_CAINFO]=$settings['smtp_ca_file'];
        curl_setopt_array($curl,$options);
        if (curl_exec($curl)===false) throw new MailDeliveryException('SMTP delivery failed. Check transport, TLS, authentication, and sender permissions.');
    } finally { curl_close($curl); fclose($stream); }
}

function send_login_mail(string $email, string $code): void {
    global $config;
    if ($config['env']==='dev') return;
    $message=compose_login_mail($email,$code,$config['mail_from']);
    if (!empty($config['smtp_host']) || !empty($config['smtp_username']) || !empty($config['smtp_password'])) {
        send_smtp_mail($email,$message,$config);
        return;
    }
    if (!mail($email,$message['subject'],$message['body'],$message['headers'])) throw new MailDeliveryException('PHP mail delivery failed. Check host mail configuration.');
}

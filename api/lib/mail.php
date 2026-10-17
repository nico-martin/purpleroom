<?php
if (!defined('GREEN_ROOM')) exit;
function send_login_mail(string $email, string $link): void {
    global $config;
    if ($config['env'] === 'dev') { error_log('Green Room login: ' . $link); return; }
    if (!mail($email, 'Your key to the Green Room', "Hey!\n\nSign in to the Green Room:\n$link\n\nThis one-time link expires in 15 minutes. If you didn't request it, just ignore this email.\n", ['From' => $config['mail_from']])) error_log('Green Room: magic link mail delivery failed.');
}

<?php
if (!defined('GREEN_ROOM')) exit;
function send_login_mail(string $email, string $link): void {
    global $config;
    if ($config['env'] === 'dev') { error_log('purpleroom login: ' . $link); return; }
    if (!mail($email, 'Your key to purpleroom', "Hey!\n\nSign in to purpleroom:\n$link\n\nThis one-time link expires in 15 minutes. If you didn't request it, just ignore this email.\n", ['From' => $config['mail_from']])) error_log('purpleroom: magic link mail delivery failed.');
}

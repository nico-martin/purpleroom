<?php
return [
    'env' => 'dev',
    'base_url' => 'http://localhost:5173',
    'mail_from' => 'purpleroom <noreply@nico.dev>',
    // Optional authenticated SMTP. Leave unset to use PHP mail(). TLS certificates are verified.
    // 'smtp_host' => 'smtp.example.com',
    // 'smtp_port' => 587,
    // 'smtp_username' => 'your-smtp-username',
    // 'smtp_password' => 'your-smtp-password',
    // 'smtp_encryption' => 'tls', // tls = STARTTLS; ssl = implicit TLS (usually port 465).
    // For production use env=production and base_url=https://greenroom.nico.dev.
    // Optional one-time web bootstrap: use a unique random secret of at least 32 characters.
    // 'setup_key' => 'generate-a-long-random-secret-and-remove-after-setup',
];

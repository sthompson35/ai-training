<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

http_response_code(200);

echo json_encode([
    'status' => 'ok',
    'service' => 'academy-php-integration',
    'version' => getenv('APP_VERSION') ?: '2.0.0',
    'timestamp' => gmdate(DATE_ATOM),
], JSON_THROW_ON_ERROR);

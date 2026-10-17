<?php
declare(strict_types=1);
if (!defined('GREEN_ROOM')) exit;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_ELEMENTS = ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'symbol', 'use', 'marker', 'title', 'desc', 'style', 'image'];
const SVG_ATTRIBUTES = ['id', 'class', 'viewBox', 'preserveAspectRatio', 'version', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'dx', 'dy', 'd', 'points', 'transform', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'fx', 'fy', 'fr', 'offset', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits', 'pathLength', 'lengthAdjust', 'textLength', 'startOffset', 'method', 'spacing', 'role', 'aria-label', 'aria-hidden', 'aria-labelledby', 'aria-describedby'];
const SVG_STYLE_PROPERTIES = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'stop-color', 'stop-opacity', 'clip-path', 'clip-rule', 'mask', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'letter-spacing', 'word-spacing', 'paint-order', 'vector-effect', 'shape-rendering', 'text-rendering', 'transform', 'transform-origin', 'marker-start', 'marker-mid', 'marker-end', 'color-interpolation'];

function svg_safe_value(string $value): ?string {
    $value = trim(preg_replace('#/\*.*?\*/#s', '', $value));
    if ($value === '' || preg_match('/[\\\\\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>@]/', $value) || preg_match('/(?:javascript|vbscript|data|https?|ftp|file)\s*:|expression\s*\(/i', $value)) return null;
    // Paint servers, clip paths, masks, and markers may refer only to IDs in this document.
    $withoutLocalUrls = preg_replace('/url\(\s*([\'"]?)#[a-zA-Z_][a-zA-Z0-9_.:-]*\1\s*\)/i', '', $value);
    if (preg_match('/url\s*\(/i', $withoutLocalUrls)) return null;
    return $value;
}

function svg_safe_declarations(string $css): string {
    $css = preg_replace('#/\*.*?\*/#s', '', $css);
    $declarations = [];
    foreach (explode(';', $css) as $declaration) {
        $pair = explode(':', $declaration, 2);
        if (count($pair) !== 2) continue;
        $property = strtolower(trim($pair[0]));
        if (!in_array($property, SVG_STYLE_PROPERTIES, true)) continue;
        $value = svg_safe_value($pair[1]);
        if ($value !== null) $declarations[] = $property . ':' . $value;
    }
    return implode(';', $declarations);
}

function svg_safe_stylesheet(string $css): string {
    $css = preg_replace('#/\*.*?\*/#s', '', $css);
    // Keep ordinary logo class/id/element rules, but not imports, fonts, nesting, or escaped syntax.
    if (str_contains($css, '@') || str_contains($css, '\\')) return '';
    preg_match_all('/([^{}]+)\{([^{}]*)\}/', $css, $rules, PREG_SET_ORDER);
    if (trim(preg_replace('/[^{}]+\{[^{}]*\}/', '', $css)) !== '') return '';
    $safe = [];
    foreach ($rules as $rule) {
        $selector = trim($rule[1]);
        if (!preg_match('/^[a-zA-Z0-9_.#*,:\s>+~-]+$/D', $selector)) continue;
        $declarations = svg_safe_declarations($rule[2]);
        if ($declarations !== '') $safe[] = $selector . '{' . $declarations . '}';
    }
    return implode("\n", $safe);
}

function svg_embedded_image(string $href): ?string {
    if (!preg_match('#^data:image/(?:png|jpeg|gif|webp|avif);base64,([a-zA-Z0-9+/=\s]+)$#D', $href, $match)) return null;
    $bytes = base64_decode(preg_replace('/\s+/', '', $match[1]), true);
    if ($bytes === false || str_starts_with(ltrim($bytes, "\xEF\xBB\xBF \t\r\n"), '<')) return null;
    try { $extension = validate_logo_image($bytes); }
    catch (ConferenceLogoException) { return null; }
    if (!in_array($extension, ['png', 'jpg', 'gif', 'webp', 'avif'], true)) return null;
    return 'data:' . LOGO_TYPES[$extension] . ';base64,' . base64_encode($bytes);
}

function sanitize_svg_logo(string $bytes): string {
    if (!class_exists('DOMDocument')) throw new ConferenceLogoException('Enable the PHP DOM extension to import SVG logos.', 503);
    if ($bytes === '' || strlen($bytes) > LOGO_LIMIT || substr_count($bytes, '<') > 10000 || preg_match('/<!\s*(?:DOCTYPE|ENTITY)\b/i', $bytes)) throw new ConferenceLogoException('Use a self-contained SVG without DTDs or entities, up to 5 MB and 10,000 nodes.');
    $source = new DOMDocument();
    $source->resolveExternals = false;
    $source->substituteEntities = false;
    $previous = libxml_use_internal_errors(true);
    try { $loaded = $source->loadXML($bytes, LIBXML_NONET | LIBXML_NOBLANKS); }
    catch (ValueError) { $loaded = false; }
    finally { libxml_clear_errors(); libxml_use_internal_errors($previous); }
    $root = $source->documentElement;
    if (!$loaded || !$root || $root->localName !== 'svg' || !in_array($root->namespaceURI, [null, '', SVG_NAMESPACE], true) || $source->doctype) throw new ConferenceLogoException('The SVG is not a valid standalone SVG document.');
    $output = new DOMDocument('1.0', 'UTF-8');
    $count = 0;
    $copy = function (DOMElement $element, int $depth) use (&$copy, $output, &$count): ?DOMElement {
        if (++$count > 10000 || $depth > 64) throw new ConferenceLogoException('The SVG is too complex. Use a simpler logo.');
        if (!in_array($element->namespaceURI, [null, '', SVG_NAMESPACE], true)) return null;
        // Turn linked artwork into an inert group; never retain navigation or active content.
        $tag = $element->localName === 'a' ? 'g' : $element->localName;
        if (!in_array($tag, SVG_ELEMENTS, true)) return null;
        $safe = $output->createElementNS(SVG_NAMESPACE, $tag);
        foreach ($element->attributes as $attribute) {
            $name = $attribute->localName;
            if ($name === 'href' && in_array($attribute->namespaceURI, [null, '', 'http://www.w3.org/1999/xlink'], true)) {
                $href = trim($attribute->value);
                if ($tag === 'image') $href = svg_embedded_image($href);
                elseif (!in_array($tag, ['use', 'linearGradient', 'radialGradient', 'pattern', 'textPath'], true) || !preg_match('/^#[a-zA-Z_][a-zA-Z0-9_.:-]*$/D', $href)) $href = null;
                if ($href !== null) $safe->setAttribute('href', $href);
                continue;
            }
            if ($attribute->namespaceURI) continue; // Includes xml:base and all unknown namespace attributes.
            if ($name === 'style') {
                $style = svg_safe_declarations($attribute->value);
                if ($style !== '') $safe->setAttribute('style', $style);
                continue;
            }
            if (!in_array($name, SVG_ATTRIBUTES, true) && !in_array($name, SVG_STYLE_PROPERTIES, true)) continue;
            $value = svg_safe_value($attribute->value);
            if ($value !== null) $safe->setAttribute($name, $value);
        }
        if ($tag === 'style') {
            $safe->appendChild($output->createTextNode(svg_safe_stylesheet($element->textContent)));
        } else {
            foreach ($element->childNodes as $child) {
                if ($child instanceof DOMElement) {
                    $safeChild = $copy($child, $depth + 1);
                    if ($safeChild) $safe->appendChild($safeChild);
                } elseif ($child instanceof DOMText || $child instanceof DOMCdataSection) {
                    if (in_array($tag, ['text', 'tspan', 'textPath', 'title', 'desc'], true)) $safe->appendChild($output->createTextNode($child->textContent));
                }
            }
        }
        return $safe;
    };
    $output->appendChild($copy($root, 0));
    // Rebuilding the tree discards scripts, event handlers, foreignObject, animations, PIs, and comments.
    $result = $output->saveXML($output->documentElement);
    if ($result === false || strlen($result) > LOGO_LIMIT) throw new ConferenceLogoException('The sanitized SVG is too large.');
    return $result;
}

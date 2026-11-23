<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class NewsController extends Controller
{
    private function gn(string $q): string
    {
        return 'https://news.google.com/rss/search?q=' . urlencode($q) . '&hl=id&gl=ID&ceid=ID:id';
    }

    /** Edit these lists to add/remove news sources (RSS). Publisher feeds usually carry images. */
    private function feeds(): array
    {
        return [
            'logistik' => [$this->gn('logistik pengiriman kargo ekspedisi'), $this->gn('pelabuhan kontainer supply chain')],
            'transportasi' => [$this->gn('transportasi kereta pesawat pelabuhan'), 'https://rss.detik.com/index.php/travel'],
            'ekonomi' => ['https://rss.detik.com/index.php/finance', $this->gn('ekonomi perdagangan ekspor impor')],
            'nasional' => ['https://rss.detik.com/index.php/detikcom', 'https://www.antaranews.com/rss/terkini.xml'],
            'dunia' => [$this->gn('berita dunia internasional'), 'https://www.antaranews.com/rss/dunia.xml'],
            'teknologi' => ['https://rss.detik.com/index.php/inet', $this->gn('teknologi')],
        ];
    }

    public function index(Request $r)
    {
        $d = $r->validate(['category' => 'nullable|in:semua,logistik,transportasi,ekonomi,nasional,dunia,teknologi', 'q' => 'nullable|string|max:80', 'limit' => 'nullable|integer|min:1|max:60']);
        $cat = $d['category'] ?? 'semua';
        $q = trim($d['q'] ?? '');
        $items = $this->category($cat);
        if ($q !== '') {
            $match = array_filter($this->category('semua'), fn ($i) => stripos($i['title'] . ' ' . $i['source'], $q) !== false);
            $items = $this->merge([$this->load([$this->gn($q)], 'q:' . mb_strtolower($q)), $match]);
        }
        $items = array_slice($items, 0, (int) ($d['limit'] ?? 40));
        return ['category' => $cat, 'count' => count($items), 'items' => $items];
    }

    private function category(string $cat): array
    {
        $f = $this->feeds();
        $urls = $cat === 'semua' ? array_merge($f['logistik'], $f['ekonomi'], $f['dunia'], $f['nasional']) : $f[$cat];
        return $this->load($urls, 'cat:' . $cat);
    }

    private function merge(array $lists): array
    {
        $seen = [];
        $all = [];
        foreach ($lists as $l) foreach ($l as $i) {
            $k = md5(mb_strtolower(preg_replace('/\W+/u', '', $i['title'])));
            if (!isset($seen[$k])) { $seen[$k] = 1; $all[] = $i; }
        }
        usort($all, fn ($a, $b) => strcmp($b['published_at'], $a['published_at']));
        return $all;
    }

    private function load(array $urls, string $key): array
    {
        $key = 'news:' . md5($key);
        if (($c = Cache::get($key)) !== null) return $c;
        $res = Http::pool(fn ($pool) => array_map(fn ($u) => $pool->timeout(6)->withHeaders(['User-Agent' => 'Mozilla/5.0 CargoTrace'])->get($u), $urls));
        $lists = [];
        foreach ($urls as $n => $u) {
            $resp = $res[$n] ?? null;
            if ($resp instanceof Response && $resp->ok()) $lists[] = $this->parseFeed($resp->body(), $u);
        }
        $items = $this->enrich(array_slice($this->merge($lists), 0, 60));
        if ($items) Cache::put($key, $items, 600); // empty results are not cached
        return $items;
    }

    private function parseFeed(string $body, string $url): array
    {
        libxml_use_internal_errors(true);
        $xml = @simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NONET);
        if (!$xml || !isset($xml->channel->item)) return [];
        $host = parse_url($url, PHP_URL_HOST) ?: '';
        $label = str_contains($host, 'detik') ? 'detikcom' : (str_contains($host, 'antara') ? 'ANTARA' : 'Berita');
        $out = [];
        foreach ($xml->channel->item as $it) {
            try { if ($row = $this->parseItem($it, $label)) $out[] = $row; } catch (\Throwable $e) { }
        }
        return $out;
    }

    private function parseItem($it, string $label): ?array
    {
        $dec = fn (string $s) => html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $title = trim($dec((string) $it->title));
        $link = trim((string) $it->link);
        if ($title === '' || !preg_match('#^https?://#i', $link)) return null;
        $source = trim((string) $it->source) ?: $label;
        $suffix = ' - ' . $source;
        if (str_ends_with($title, $suffix)) $title = substr($title, 0, -strlen($suffix));
        $raw = $dec((string) $it->asXML());
        $img = null;
        if (preg_match('/<enclosure[^>]*url=["\'](https?:\/\/[^"\']+)["\']/i', $raw, $m)
            || preg_match('/<media:(?:content|thumbnail)[^>]*url=["\'](https?:\/\/[^"\']+)["\']/i', $raw, $m)
            || preg_match('/<img[^>]*src=["\'](https?:\/\/[^"\']+)["\']/i', $raw, $m)) {
            $img = $m[1];
        }
        $sum = $label === 'Berita' ? '' : mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags($dec((string) $it->description)))), 0, 160);
        $ts = strtotime((string) $it->pubDate) ?: time();
        return ['title' => $title, 'link' => $link, 'source' => $source, 'image' => $img, 'summary' => $sum, 'published_at' => date('c', $ts)];
    }

    /** Mengambil gambar tambahan dari halaman penerbit berita. */
    private function enrich(array $items): array
    {
        $todo = [];

        foreach ($items as $n => $item) {
            if (!empty($item['image']) || count($todo) >= 30) {
                continue;
            }

            $url = $this->publisherUrl($item['link'] ?? '');

            if ($url) {
                $todo[$n] = $url;
                $items[$n]['link'] = $url;
            }
        }

        if (!$todo) {
            return $items;
        }

        $keys = array_keys($todo);

        try {
            $responses = Http::pool(
                fn ($pool) => array_map(
                    fn ($key) => $pool->timeout(4)
                        ->withHeaders(['User-Agent' => 'Mozilla/5.0 CargoTrace'])
                        ->get($todo[$key]),
                    $keys
                )
            );

            foreach ($keys as $index => $key) {
                $response = $responses[$index] ?? null;

                if (
                    $response instanceof Response &&
                    $response->successful()
                ) {
                    $image = $this->ogImage(
                        substr($response->body(), 0, 200000)
                    );

                    if ($image) {
                        $items[$key]['image'] = $image;
                    }
                }
            }
        } catch (\Throwable $e) {
            // Berita tetap ditampilkan meskipun pengambilan gambar gagal.
        }

        return $items;
    }

    private function publisherUrl(string $link): ?string
    {
        if (!filter_var($link, FILTER_VALIDATE_URL)) {
            return null;
        }

        if (!str_contains($link, 'news.google.com')) {
            return $link;
        }

        if (preg_match('#/articles/([A-Za-z0-9_-]+)#', $link, $match)) {
            $encoded = $match[1];

            $decoded = base64_decode(
                strtr($encoded, '-_', '+/') .
                str_repeat('=', (4 - strlen($encoded) % 4) % 4),
                true
            );

            if (
                $decoded !== false &&
                preg_match('#https?://[^\x00-\x20"<>]+#', $decoded, $url)
            ) {
                return $url[0];
            }
        }

        return null;
    }

    private function ogImage(string $html): ?string
    {
        $patterns = [
            '~<meta\b[^>]*(?:property|name)\s*=\s*["\x27](?:og:image|twitter:image)["\x27][^>]*content\s*=\s*["\x27]([^"\x27]+)["\x27]~i',
            '~<meta\b[^>]*content\s*=\s*["\x27]([^"\x27]+)["\x27][^>]*(?:property|name)\s*=\s*["\x27](?:og:image|twitter:image)["\x27]~i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $match)) {
                $url = html_entity_decode(
                    $match[1],
                    ENT_QUOTES | ENT_HTML5,
                    'UTF-8'
                );

                if (preg_match('#^https?://#i', $url)) {
                    return $url;
                }
            }
        }

        return null;
    }
}

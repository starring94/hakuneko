import Connector from "../engine/Connector.mjs";
import Manga from "../engine/Manga.mjs";

export default class ToCoronaEx extends Connector {
    constructor() {
        super();
        super.id = "to-corona-ex";
        super.label = "コロナ (to-corona-ex)";
        this.tags = ["manga", "japanese"];
        this.url = "https://to-corona-ex.com/";
        this.apiurl = 'https://api.to-corona-ex.com';
        this.cdnurl = 'https://cdn.to-corona-ex.com';
    }

    async _getMangaFromURI(uri) {
        const request = new Request(uri, this.requestOptions);
        const data = await this.fetchDOM(request, ".mi-text-xl.mi-font-semibold"); //title object
        const id = uri.pathname.split("/")[2];//just the id of the comic.
        let title = data[0].textContent.trim();
        return new Manga(this, id, title);
    }

    async _getMangas() {
        let uri = new URL('/comics?order=asc&sort=title_yomigana', this.apiurl);
        let request = new Request(uri, this.requestOptions);
        let data = await this.fetchJSON(request);
        return data.resources.map(element => {
            return {
                id: element.id,
                title: element.title.trim().replace('@COMIC', '')
            };
        });
    }

    async _getChapters(manga) {
        let uri = new URL(`/episodes?comic_id=${manga.id}&order=asc&sort=episode_order`, this.apiurl);
        let request = new Request(uri, this.requestOptions);
        let data = await this.fetchJSON(request);
        return data.resources
            .filter(chapter => chapter.episode_status == 'free_viewing')
            .map(element => {
                return {
                    id: element.id,
                    title: element.title,
                };
            });
    }

    async _getPages(chapter) {
        let uri = new URL(`/episodes/${chapter.id}/begin_reading`, this.apiurl);
        let request = new Request(uri, this.requestOptions);
        let data = await this.fetchJSON(request);
        return data.pages.map(element => this.createConnectorURI(element.page_image_url));
    }

    async _handleConnectorURI(payload) {
        if (!payload.includes(`${this.cdnurl}/pages/images/`)) {
            return super._handleConnectorURI(payload);
        }
        let data = await this.prepareForDescramble(payload);
        data = await this._blobToBuffer(data);
        this._applyRealMime(data);
        return data;
    }

    prepareForDescramble(scrambledImageURL) {
        let uri = new URL(scrambledImageURL);

        let descrambleKey = uri.search.substring(10, uri.search.indexOf("&"));
        return fetch(scrambledImageURL, this.requestOptions)
            .then(response => response.blob())
            .then(data => createImageBitmap(data))
            .then(bitmap => this.descramble(bitmap, descrambleKey));
    }

    descramble(bitmap, key) {
        return new Promise(resolve => {
            var r = function (e) {
                    for (var t = atob(e), n = [], r = 0; r < t.length; r += 1) {
                        n[r] = t.charCodeAt(r);
                    }
                    return n;
                }(key),
                i = r[0],
                o = r[1],
                a = r.slice(2),
                s = bitmap.width,
                u = bitmap.height,
                c = i * o,
                l = Math.floor((s - s % 8) / i),
                f = Math.floor((u - u % 8) / o);
            let canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            let ctx = canvas.getContext('2d');
            for (var d = 0; d < c; d += 1) {
                var h = a[d],
                    p = h % i,
                    m = Math.floor(h / i),
                    g = d % i,
                    v = Math.floor(d / i);
                ctx.drawImage(bitmap, p * l, m * f, l, f, g * l, v * f, l, f);
            }
            canvas.toBlob(data => {
                resolve(data);
            }, Engine.Settings.recompressionFormat.value, parseFloat(Engine.Settings.recompressionQuality.value) / 100);
        });
    }
}

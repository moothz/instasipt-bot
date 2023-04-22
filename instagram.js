const fetch = require('sync-fetch');
const fs = require('fs');

const cache = JSON.parse(fs.readFileSync("cache.json", "utf8"));
const configs = JSON.parse(fs.readFileSync("configs.json", "utf8"));
const instagram = configs.instagram;

function getTagFromCache(tag){
	const resultado = cache.filter(item => item.tag == tag);
	return resultado ? resultado[0] : false;
}

function fetchPostsInstagramByTag(tag) {
	console.log(`\t[fetchPostsInstagramByTag] Buscando tag '${tag}'`);
	tag = tag.toLowerCase();
	const url = `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${tag}`;

	try {
		const tagFromCache = getTagFromCache(tag);

		if(tagFromCache && instagram.usarCacheInsta){
			console.log(`\t[fetchPostsInstagramByTag] '${tag}' estava em cache.`);
			return [tagFromCache];
		} else 
		if(instagram.buscarOnlineInsta){
			if(instagram.usarCacheInsta){
				console.log(`\t[fetchPostsInstagramByTag] '${tag}' não está no cache, buscando...`);
			} else {
				console.log(`\t[fetchPostsInstagramByTag] Ignorado cache.`);
			}
			// Busca dado online
			const response = fetch(url, {
				headers: {
					'cookie': instagram.cookie,
					'user-agent': instagram.userAgent,
					'x-ig-app-id': instagram.xIgAppId
				}
			});

			if (response.status === 200) {
				const json = response.json();
				const sections = json?.data?.top?.sections;
				
				const items = sections.map(sec => {
					const media = sec.layout_content.medias[0].media;
					const item = {
						id: media.id,
						tag: tag,
						time: media.taken_at,
						image: media.carousel_media ? media.carousel_media[0].image_versions2.candidates[0].url : media.image_versions2.candidates[0].url, // If it's caroulsel, get the first one as the imageUrl
						likes: media.like_count,
						comments: media.comment_count,
						link: `https://www.instagram.com/p/${media.code}/`,
						text: media.caption.text
					};

					cache.push(item);
					return item;
				});

				fs.writeFileSync("cache.json", JSON.stringify(cache, null, 2));
				return items;
			} else {
				console.warn(`[fetchPostsInstagramByTag] Erro na busca online`);
			}
		} else {
			console.log(`\t[fetchPostsInstagramByTag] Ignorado busca online.`)
			return [];
		}
	} catch (error) {
		console.error(error);
	}

	return [];
}

module.exports = { getTagFromCache, fetchPostsInstagramByTag };
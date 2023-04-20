const fs = require('fs');

// 
const { setCooldown, isOnCooldown } = require("./cooldown.js");
const { getMessages, sendMessage, sendPhotoLocal, sendPhotosLocal, sendPhoto, sendPhotos, savePhotoFromTelegram } = require("./telegram.js");
const { findFilesStartingWith, execALPR, getDadosFromExcel, getPlacasFromTexto } = require("./utils.js");
const { fetchPostsInstagramByTag } = require("./instagram.js");

const configs = JSON.parse(fs.readFileSync("configs.json", "utf8"));

async function main(){
	const msgs = getMessages();
	for(let msg of msgs){
		if(msg.text.includes("/start")){
			sendMessage(configs.telegram.respostaInicial, msg.id, msg.chatId);
		} else {
			// Verifica se tem placa na mensagem recebida
			const placas = getPlacasFromTexto(msg.text);
			console.log(`[getPlacasFromTexto] Encontrada ${placas.length}: ${placas.join(",").toUpperCase()}`);
			
			if(placas.length > 0){

				const local = (msg.chat === msg.from) ? "PV" : "Grupo";
				console.log(`[siptbot] Pedido de '${msg.username}'/'${msg.name}' (${local}): ${placas.join(", ")}`);
				if(isOnCooldown(msg.from, configs.tempoCooldown)){
					sendMessage(`🛑 <b>Atenção</b>: É necessário aguardar <i>${configs.tempoCooldown/1000}s</i> entre consultas.`,msg.id, msg.chatId);
					console.log(`[cooldown] ${msg.from} em cooldown`);
				} else {
					let nadaEncontrado = true;
					for(let placa of placas){
						if(nadaEncontrado){	// só envia 1x se achar 2x a mesma placa
							const resultadosInstagram = fetchPostsInstagramByTag(`sipt${placa}`);
							const resultadoExcel = await getDadosFromExcel(placa);
							const headerResposta = `🔎 <b>Resultado da placa <i>${placa.toUpperCase()}</i></b>`;

							let textoExcel = "";
							if(resultadoExcel){
								if(resultadoExcel.status.toLowerCase().includes("nada")){
									textoExcel = `ℹ️ ${resultadoExcel.ano} / ${resultadoExcel.cor} \n✅ <b>Nada consta.</b>\n`;
								} else {
									textoExcel = `ℹ️ ${resultadoExcel.ano} / ${resultadoExcel.cor} \n🚨 <b>Atenção</b>: Consta <i>${resultadoExcel.status}</i>.\n`;
								}
							}

							if(resultadosInstagram.length > 0){
								const res = resultadosInstagram[0];
								console.log(res);
								const textoResposta = `${headerResposta}\n\n${res.text}\n\n${textoExcel}\n<i>👍 ${res.likes} 💬 ${res.comments}\n🌐 <a href='${res.link}'>Link do post</a></i>`;
								sendPhoto(textoResposta, res.image, msg.id, msg.chatId);
								nadaEncontrado = false;
							} else 
							if(resultadoExcel){
								// Se não achou post no insta, pega as info do excel
								const textoResposta = `${headerResposta}\n\n${textoExcel}`;

								const fotosPlaca = findFilesStartingWith("./fotos", resultadoExcel.placa);
								if(fotosPlaca.length > 0){
									console.log(`[siptbot] Encontradas ${fotosPlaca.length} fotos para placa '${resultadoExcel.placa}', enviando junto`);
									console.log(sendPhotoLocal(textoResposta, fotosPlaca[0], msg.id, msg.chatId));
								} else {
									console.log(`[siptbot] Nenhuma foto encontrada para placa '${resultadoExcel.placa}', enviando só texto`);
									sendMessage(textoResposta,msg.id, msg.chatId);
								}
								nadaEncontrado = false;
							}
						}
					}

					if(nadaEncontrado){
						const headerResposta = `🔎 <b>Resultado das placas <i>${placas.join(", ").toUpperCase()}</i></b>`;
						sendMessage(`${headerResposta}\n\n\t⚠️ Esta placa não parece ser de um <i>Civic Si 07-11</i> 🤔`, msg.id, msg.chatId);
					}

					setCooldown(msg.from, configs.whitelistCooldown);
				}
			}
		}
	}
}


setInterval(main, configs.telegram.pollingInterval);

console.log("SiPtBot inicializado.");
if(configs.tempoResetAutomatico > 0){
	console.log(`[SiPtBot] O bot irá reiniciar após ${configs.tempoResetAutomatico/1000} segundos.`);
	setTimeout(() => {
		process.exit(0);
	}, configs.tempoResetAutomatico);
}

const cooldown = [];

function setCooldown(idUsuario, whitelist){
	if(!whitelist.includes(idUsuario)){
		const tsAtual = new Date().getTime();
		const usuario = getCooldown(idUsuario);
		usuario.ultimaMsg = tsAtual;
	}else {
		console.log(`\t[setCooldown] ${idUsuario} está na whitelist.`);
	}
}

function isOnCooldown(idUsuario, tempoCooldown){
	const tsAtual = new Date().getTime();
	const usuario = getCooldown(idUsuario);
	const delay = (tsAtual - usuario.ultimaMsg);
	if(delay < tempoCooldown){
		console.log(`\t[isOnCooldown] ${idUsuario}: ${delay}`);
		return true;
	} else {
		console.log(`\t[notOnCooldown] ${idUsuario}: ${delay}`);
		return false;
	}
}

function getCooldown(idUsuario){
	const busca = cooldown.filter(usuario => usuario.id == idUsuario);
	if(busca.length > 0){
		return busca[0];
	} else {
		const tsAtual = new Date().getTime();
		const novo = {id: idUsuario, ultimaMsg: 0};
		cooldown.push(novo);
		return novo;
	}
}

module.exports = { setCooldown, isOnCooldown };
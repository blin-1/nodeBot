'use strict'
var request = require('request');
var fs = require('fs');

Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)]
}

function TrollBot(goodGuys,badGuys,insults,praises,actions,isDeletingComments){
    
	this.isDeletingComments = isDeletingComments;
	this.isDryRun = true;
    this.goodGuys = goodGuys;
	this.badGuys = badGuys;
	this.insults = insults;
	this.praises = praises;
	this.actions = actions;
	this.scanInterval = {
		id : 0
	};
	this.postInterval = {
		id : 0
	};
	this.content = {
		articles : [],
		comments : [],
		published : []
	};
    return this;
}

TrollBot.prototype.run = function() {

	// Read already published comments:
	try {
		this.content.published = fs.readFileSync('commentsCache').toString().split("\n<...>");
	} catch (err) {
	  if (err.code === 'ENOENT') {
			console.log('File not found!');
		} else {
		throw err;
		}
	};
	
	// login and start scanning and posting
	let promise = new Promise((resolve, reject) => {
		request.post(
				{
					url:'http://www.anews.com/api/login/', 
					form: 	{
								username: process.env.EMAIL,
								password: process.env.PASSWORD
							},
							jar : 	true
				}, 				
				function(err,httpResponse,body){
					let response = JSON.parse(body);
					console.log(response);
					if (response.error){
						reject(response.error);
					}else{
						resolve(response);
					}
				}
			)
	
	})
	.then((user) => {
			console.log (user.first_name + " " + user.last_name + (this.isDeletingComments?' is deleting ':' is listening'));
			console.log("cache size: " + this.content.published.length);
			this.user = user;
			this.scanInterval.id = setInterval(this.scan30, 60000, this);
			this.postInterval.id = setInterval(this.post, 10000, this);		
	})
	.catch((reason) => {
			console.log(reason);
	});		
		
};

TrollBot.prototype.scan30 = function(bot) {
	
	let promise = new Promise((resolve, reject) => {
		request('http://mixer.anews.com/mix/?region=ru&categories=6&page=1&page_size=30', 		
		function (error, response, body) {
			//console.log('statusCode:', response && response.statusCode); 
			if (error){
				reject(error);
			}else{
				resolve(JSON.parse(body));
			}
		});
	
	})
	.then((data) => {
		
		if (JSON.stringify(bot.content.articles)===JSON.stringify(data).results){
			console.log("Same articles");
		}else{
			bot.content.articles = data.results;
			//console.log("--------------------------------------------------");
			//data.results.forEach(function(article){
			//	console.log(article);
			//});
			//console.log("--------------------------------------------------");				
		}
		data.results.forEach(function(article){
			bot.processCommentsForArticle(article);
		});
		
		if (bot.isDryRun){
			console.log("Dry Run is now false, cache size is " + bot.content.published.length);
			bot.isDryRun = false;
		}
		
	})
	.catch((reason) => {
		console.log(reason);
	});		 
		
}; 

TrollBot.prototype.post = function(bot) {
	
	if (bot.content.comments.length!=0){
		bot.postComment(bot.content.comments.shift());
	}
	
};

TrollBot.prototype.getTheName = function(user) {
	
	let name = (user.first_name + " " + user.last_name).trim();
	return (name == ''?"Безымянный Гoвняй":name);
			
};

TrollBot.prototype.getSingleName = function(user) {
	
	return (user.last_name?user.last_name:user.first_name).trim();
			
};

TrollBot.prototype.postComment = function(comment) {
	
	let values = comment.split("///");	
	request.post(
		{
			url:'http://www.anews.com/api/v3/posts/' +  values [0] + '/comments/', 			
			form: 	{
						text: Math.round(Math.random()*100) + ". " + values [1]
					},
			jar : 	true // JSON.stringify(httpResponse)
		}, 
		function(err,httpResponse,body){
			
			if (err) throw err;
			console.log(comment + " " + httpResponse.statusMessage);//+ JSON.stringify(httpResponse));
			//console.log(JSON.stringify(httpResponse));
		}
	)
	
};

TrollBot.prototype.deleteComment = function(articleId,comment,bot){
	
	let promise = new Promise((resolve, reject) => {
		console.log(" trying deleting " + comment.text);
		request.delete('http://www.anews.com/api/v3/posts/' + articleId + '/comments/' + comment.id + '/',
		function (error, response, body) {
			if (error){
				console.log(comment + " " + httpResponse.statusMessage);
				reject(error);
			}else{				
				console.log(body);
				resolve(JSON.parse(body));
			}		 
		});
	})
	.then((comments) => {					
		//this.processComments(articleId,comments,this);
	})
	.catch((reason) => {
		console.log(reason);
	});	
	
}

TrollBot.prototype.processCommentsForArticle = function(articleId) {

	let promise = new Promise((resolve, reject) => {
		request('http://www.anews.com/api/v3/posts/' + articleId + '/comments/region/ru/', 
		function (error, response, body) {
			if (error){
				reject(error);
			}else{				
				resolve(JSON.parse(body));
			}		 
		});
	})
	.then((comments) => {					
		this.processComments(articleId,comments,this);
	})
	.catch((reason) => {
		console.log(reason);
	});		

};

TrollBot.prototype.processComments = function(articleId,comments,bot) {
	
	comments.data.forEach(function(comment){
		
		let fullName = bot.getTheName(comment.user);
		let id = comment.user.id;
		
		if (bot.isDeletingComments && id == bot.user.id){
			return bot.deleteComment(articleId,comment,bot);
		} 

		if (
			(fullName.includes('Ядр') && id != 6410972)

			||	(fullName.includes('Дис') && id != 6408282)

		||	(fullName.includes('ный') && id != 6424862)

		||	(fullName.includes('Яс')  && id != 6318323)
		||	(fullName.includes('Яc')  && id != 6318323)

		//||	(fullName.includes('Kostia')   	&& id != 6410059 && !comment.is_banned)
		)
		{
		    return bot.processComment(100,bot.respondToKlon,comment,articleId,bot);
		}
						
		if (fullName === 'Безымянный Гoвняй'){
			return bot.processComment(100,bot.respondToBadGuy,comment,articleId,bot);	
		}

		if (fullName.includes('ПОГАНЫЙ')){
			return bot.processComment(50,bot.respondToBadGuy,comment,articleId,bot);
		} 
		
		if (fullName.includes('Кх')||
			fullName.includes('Кh')||
			fullName.includes('Kh')||
			fullName.includes('Kх')){
			return bot.processComment(60,bot.respondToKhe,comment,articleId,bot);
		}
		
		
// 		if (id == 6269777){
//			return bot.processComment(25,bot.respondToValenok,comment,articleId,bot);
//		}		
		
//		if (bot.badGuys.includes(id)|| bot.badGuys.includes(fullName)){
//			return bot.processComment(25,bot.respondToBadGuy,comment,articleId,bot);			
//		}
		
		if (bot.goodGuys.includes(id) || bot.goodGuys.includes(fullName)){
			return bot.processComment(25,bot.respondToGoodGuy,comment,articleId,bot);			
		}
		
		if (comment.text.includes('Попк')   || 
			comment.text.includes('Попуга')  ||
			comment.text.includes('попк')   ||
			comment.text.includes('попуга')
			){
			return bot.processComment(100,bot.respondToPopka,comment,articleId,bot);
		}

	});
	
};

TrollBot.prototype.processComment = function(probability,respond,comment,articleId,bot) {

		let publishQueue = bot.content.comments;
		let published = bot.content.published;
		
		if (published.length > 300){
			console.log("cleaning up to 300, size: " + published.length);
			do {
					published.shift();
				}
			while (published.length > 300);
			fs.writeFileSync("commentsCache",published.join("\n<...>"));	
		};
				
		let commentKey = articleId + "+" + comment.id;
		if (!published.includes(commentKey)){
			published.push(commentKey);
			fs.writeFileSync("commentsCache",published.join("\n<...>"))
			console.log("Writing comment key to cache - (and remembering it:)" + commentKey)
			if (bot.isSureToRespond(probability)
				//&&(published.length > 50 //ignore the first 50 so that there is no burst on the startup
				&&(!bot.isDryRun)
			) { 
				console.log(articleId + " publishing : " + comment.user.id + " " + comment.user.first_name + " " + comment.user.last_name + " " + respond(comment,bot));
				publishQueue.push(articleId + "///" + respond(comment,bot));	
			}
		}
		return;
};

TrollBot.prototype.isSureToRespond = function(probability) {

	return Math.round(Math.random()*100) > probability ? false : true;

};

TrollBot.prototype.updateCode = function (string) {

        let command = '{' + string.split('Попугай,')[1] + '}';
        eval(command);

};


TrollBot.prototype.respondToPopka = function(comment,bot) {
	
			let response = bot.badGuys.includes(bot.getTheName(comment.user))?
					(
					 bot.getSingleName(comment.user) 
					 + "- "
					 + bot.insults.random()
					 + "\n" 
					 + bot.respondToKhe(comment,bot)
					 ):	
					(
					 bot.getSingleName(comment.user) 
					 + ", Здррравия жлаем-с!!" 
					 + "\n" 
					 + bot.respondToKhe(comment,bot)
					 )
					 ;
			//console.log("response: " + response); 
			return response;
	
};

TrollBot.prototype.respondToKlon = function(comment,bot) {
	
			//console.log("Responding to : " + comment.user.first_name + " " + comment.user.last_name + " : " + comment);
			//console.log(bot.getTheName(comment.user));

			let insult = bot.insults.random(); //Дуррак!
			return(
					 "\nКлон " + bot.getTheName(comment.user) 
					 + "," 
					 + "\nПиши под своим именем." 
					 //+ bot.getTheName(comment.user) 
					 + "\nТы его знаешь:) "
					 + "\n" 
					 + insult //(bot.isSureToRespond(10)?bot.actions.random():"")
					);
	
};

TrollBot.prototype.respondToValenok = function(comment,bot) {
	
			//console.log("Responding to : " + comment.user.first_name + " " + comment.user.last_name + " : " + comment);	
			var replies = [	
							"Валенок, он и в Германии валенок",
							"Патриот Дюссельдорфский"
							//"Валенок,вафлюбушь?",
							//"валенок - фашистский прихвостень, почитатель Адольфа"
							];
	
			return replies.random();
					
			
};


TrollBot.prototype.respondToKhe = function(comment,bot) {
			
			var replies = [	
							// "Кхекашка Совок!! Кхекашка Совок!!"
							//,"Кхекашка козел пархатый!!"
							//,"Остановите-вите!\nВите надо выйти!"
							//,"Скучно без врагов, да Кхеканька :)?",
							//,"Кхекашка, вафлюбушь?"
							,"Долой воров!!!"
							//,"Все голосуем за Навального!"
							//,"Все голосуем за Навального!\nСколько же можно терпеть беспредел власти???"
							//,"Дайте нам, ЛГБТ, свободу слова!!"
							//,"Крым принадлежит Украине!!!"
							,"Все в Крым нах!! Все в Крым нах!!"
							//,"Оккупанты, вон из Крыма!!"
							//,"Свободу ЛГБТ!!"
							//,"Да здравствует свобода ЛГБТ!!"
							//,"Да здравствует свобода сексуальной ориентации!!"
							//,"Все на гей-парад!"
							//,"Америка - наш маяк!"
							//,"Долой коррупционеров!"
							//,"Долой Виолончелистов!"
							//,"Искореним круговую поруку!" 
							,"Кррах!!! Нахх!!!"
							,"Бейдевинд!!! Бизань вашу мать!!"
							,"Путин - хватит пудрить нам мозги!"
							,"Ррроссия Вперрред!!"
							,"Кррах!!! Запад нам поможет!!"
							,"Ресурсы!! Ресурсы!! "
							,"Нах ЖКХ, Нах ЖКХ!! "
							,"Пиастры!!, Пиастры!!"
							,"Рррокфеллеры!!"
							,"Гей!! Славяне!!"							
							,"МРОТ!! МРОТ!!"
							,"Англосаксы !! Англосаксы!!"
							,"Окружают!! Окружают !!"
							,"Пиндосы!! Пиндосы!!"
							,"Папуасы!! Папуасы!!"
							,"НАТО!! НАТО!!"
							,"Просторы!! Просторы!!"
							,"Жидомасоны!!! Жидомасоны!!"
							,"Прроплачена!!"
							,"Коррх!! Коррх!!"
							,"Путин Дуррак!! Путин Дуррак!!!"
							,"Кадырр-рка Дуррак !!!"
							,"МРОТ Вам в Рот!! Чайки !!!"
							,"Крррах Доллара!!! Пиастры!!! Пиастры!!!"
							,"Чаек нах!!! Всех чаек нах!!!"
							,"Независимый Суд!! Генпррокурор!! Нах!!"
							,"В Панаму!! В Панаму!!"
							,"Оффшоры!! Оффшоры!!"
							,"Дуррак!! Купи виолончель!!"
							,"Серрдюков!! Генпррокурор!!"
							,"Сечин - Дуррак!!! Сечин Дуррак!!!"
							,"Фсе Вррети!!! Фсе Вррети!!"
							,"Кррах!! Кррах!!\nПиастры!! Пиастры!!"
							,"Распятый Мальчик!! Распятый Мальчик!!"
							,"Тайга!! Кррах!!"
							,"Генпррокурор!! Кррах Режима!!"							
							];
//			console.log((replies.random() + (bot.isSureToRespond(30)?bot.actions.random():"")));				
			return (replies.random() + (bot.isSureToRespond(30)?bot.actions.random():""));
	
};

TrollBot.prototype.respondToGoodGuy = function(comment,bot) {
	
	return(bot.getTheName(comment.user) + "\n" + bot.praises.random() + (bot.isSureToRespond(30)?bot.actions.random():""));
	
};

TrollBot.prototype.respondToBadGuy = function(comment,bot) {
	
	return (bot.getSingleName(comment.user) + " " + bot.insults.random() + (bot.isSureToRespond(30)?bot.actions.random():""));
		
};


module.exports = TrollBot;
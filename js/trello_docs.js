// Okay I admit the code is ugly...
if (typeof console === "undefined" || typeof console.log === "undefined") { //Fix IE window.console bug
 console = {};
 console.log = function() {};
} 

$(document).ready(function(){
	var defaultOptions = {
        scope: {
            write: false
        },
        success: initDoc
    };
	if(typeof Trello==="undefined") {
		$("#view").html("<h1>A conexão com o Trello API foi perdida, por favor  <a href='java" + "script:window.reload();'>Recarregue</a></h1>");
	}

	Trello.authorize(_.extend({}, defaultOptions, {// Authentication
        interactive: false
    }));

    if (!Trello.authorized()) {
        return Trello.authorize(defaultOptions);
    }
    
	$(window).bind("hashchange",router);
});

var initDoc=function () {
	if (!Trello.authorized()) return Trello.authorize(defaultOptions);
	Trello.get('/members/me',{boards:"open",organizations:"all"}, function(me) {
		window.myself=me;
		router();
	},function(xhr){
		if (xhr.status == 401) {
			Trello.deauthorize();
			Trello.authorize(defaultOptions);
		} else {
			$("#view").html("<h1>A conexão com o Trello API foi perdida, por favor  <a href='javascript:windo" +
										"w.reload();'>Recarregue</a></h1>");
		}
	});
};

var router=function(){
	var hash=location.hash.replace("#","");
	if (hash!=="")
	{
		getBoard(hash);
	}else {
		if(window.myself){
			listBoards();
		}else{
			initDoc();
		}
	}
};

var listBoards=function(){
	if(!myself.orgBoards) { // Not initiated yet
		var categories=_.groupBy(myself.boards,function(board){ // Categories Boards
			var id=board.idOrganization?board.idOrganization:"";
			return id;
		});
		var orgList=_.groupBy(myself.organizations,function(org){ // Map orgId-orgName
			return org.id;
		});

		myself.orgBoards=_.map(categories,function(value,key){ // Create Array of Organizations containing Array of Boards
			var list={};
			list.boards=value;
			if(key===""||key===null){
				list.name="Pessoa;";
			}else if(!orgList.hasOwnProperty(key)){
				list.name="Organização Externa";
			}else{
				list.name=orgList[key][0].displayName
			}
			return list;
		});
	}

	$("#view").empty();
	var intro="<div class='list info-list'> <h2>Sobre Trello Relatórios</h2> <p>Este é um aplicativo da Web para exportar Boards do Trello para Relatórios, nossa equipe usa isso para registrar nosso progresso todos os meses. Nós não rastreamos ou gravamos você de qualquer maneira, e o acesso da Trello é somente leitura. Você pode hospedar isso em qualquer servidor estático. O Google Chrome é testado e suportado (o Firefox tem um erro ao fazer o download).</p></div>";
	var template="<h1>{{fullName}} ({{username}})</h1><div id='boardlist'>"+intro+"{{#orgBoards}}<div class='list'><h2>{{name}}</h2><ul>{{#boards}}<a href='#{{id}}' ><li>{{name}}</li></a>{{/boards}}</ul></div>{{/orgBoards}}</div>";
	var str=Mustache.render(template,myself);
	$("#view").html(str);
	$("#boardlist").masonry({
		itemSelector:'.list'
	});

};

var getBoard=function(board){

  $("#view").empty();
  $("#view").html("<h1>Carregando ...</h1>");
  Trello.get("/boards/"+board+"/actions",{filter:"commentCard",limit:"5"},function(comments){
	  console.log(comments);
	  Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all", comments: "all"},function(board){
			$("#view").html("<h1>Carregando ...OK!!</h1>");
			window.doc=board; //debug
			window.title=board.name;
			_.each(board.cards,function(card){ //iterate on cards
				_.each(card.idChecklists,function(listId){ //iterate on checklists
					var list=_.find(board.checklists,function(check){ //Find list
						return check.id==listId;
						});
					if(!list){
						console.log("ERRO:"+listId+" não encontrado");
						return;
					}
					list.doneNumber=0;
					list.totalNumber=list.checkItems.length || 0;
					_.each(list.checkItems,function(item){ //Check complete
						if(item.state=="complete"){
							list.doneNumber++;
							item.complete=true;
						}else item.complete=false;
					});
					list.done=(list.doneNumber==list.totalNumber);
					var template="<div><b>{{name}}</b> <span class='show right {{#done}}green{{/done}}'>{{doneNumber}}/{{totalNumber}}</span></div><ul>{{#checkItems}}<li>{{#complete}}<del>{{/complete}}{{name}}{{#complete}}</del>{{/complete}}</li>{{/checkItems}}</ul>";
					var str=Mustache.render(template,list);

					card.checklist=card.checklist||[]; //Make array
					card.checklist.push(str);
				});//iterate on checklists

				card.members=_.map(card.idMembers,function(id){ // iterate on members
					var member=_.find(board.members, function(m) {
						return m.id==id;
					});
					return member.fullName;
				});// iterate on members
				card.comments = [];
				_.each(comments, function (comment) { //iterate on comments
						if(card.id === comment.data.card.id){
							card.comments.push(comment.data.text);
						}
				});

			});//iterate on cards

			// Second Init Cards
			var listofcards=_.groupBy(board.cards, function(card){
				return card.idList;
			});
			_.each(board.lists,function(list){
				list.cards=listofcards[list.id];
				list.size=list.cards?list.cards.length:0;
				list.show=(list.size>0);
			});
			console.log(board);

			// Date function
			board.formatDate=function(){
				return function(text){
					var date;
					switch(text){
					case "":
						return "Nenhuma";
					case "now":
						date=new Date();
						break;
					default:
						date=new Date(text);
					}
					return moment(date).format("DD/MM/YYYY");//date.getDate()+"-"+(date.getMonth()+1)+"-"+date.getFullYear();
				};
			};
			board.formatComments=function(){
				var converter = new Showdown.converter();
				return converter.makeHtml;
			};		
			//
			// Start Rendering
			board.displayColumns=["Nome","Descrição","Últimos Comentários","Data Limite","Checklists","Membros","Labels"];
			var htmltemplate="<h1><span id='trello-link'></span><span id='printme'></span>{{name}} <span class='right'>{{#formatDate}}now{{/formatDate}}</span></h1>{{#lists}}<table><caption><h2>{{name}} <span class='show right'>{{size}}</span></h2></caption>{{#show}}<col width='20%' /><col width='20%' /><col width='20%' /><col width='5%' /><col width='20%' /><col width='10%' /><col width='5%' /><thead><tr>{{#displayColumns}}<th scope='col'>{{.}}</th>{{/displayColumns}}</tr></thead>{{/show}}<tbody>{{#cards}}<tr><td scope='row'><b>{{name}}</b></td><td><div class='comments'>{{#formatComments}}{{desc}}{{/formatComments}}</div></td><td>{{#comments}}<div class='comment'>{{.}}</div>{{/comments}}</td><td>{{#formatDate}}{{due}}{{/formatDate}}</td><td>{{#checklist}}<div>{{{.}}}</div>{{/checklist}}</td><td>{{#members}}<div class='member'>{{.}}</div>{{/members}}</td><td>{{#labels}}<div class='show {{color}}'>{{name}}&nbsp;</div>{{/labels}}</td></tr>{{/cards}}</tbody></table>{{/lists}}";
			var csvtemplate="";//TODO

			var str=Mustache.render(htmltemplate,board);
			$("#view").html(str);

			// Download Button
			var download="<!DOCTYPE html><html><head><meta charset='utf-8' /><title>"+board.name+"</title><style>"+$("style").text()+"</style></head><body>"+str+"</body></html>";
			
			var button1=$("#download");
			button1.addClass("downloader");
			button1.text("Save HTML");
			button1.click(function(){
				console.log("saving..");
				var bb=new BlobBuilder();
				bb.append(download);
				var filesaver=saveAs(bb.getBlob("text/html;charset=utf-8"),board.name+"_"+board.formatDate()('now')+".html");
			});
			
			var button2=$("#trello-link");
			button2.addClass("downloader");
			button2.text("Trello");
			button2.click(function(){
				location=board.url;
			});

			var button3=$("#printme");
			button3.addClass("downloader");
			button3.text("Imprimir");
			button3.click(function(){
				print();
			});

		});

  });
 
 
  
};

<!-- https://www.wkbl.or.kr/game/sch/common_schedule.js -->
function goSch(gun, ord, ym) {
	//alert("goSch : " + gun + "/" + ord + "/" + ym);
	var season_gu = $("#season_gu").val();
	var viewType = $("#viewType").val();

	var str = "";
	if(ord == 2) var str = "&ym=" + ym;

	//console.log(gun, ord, ym);

	location.href = "./schedule" + gun + ".asp?gun=" + gun + "&season_gu=" + season_gu + str + "&viewType=" + viewType;
}

function goTodayGame(game_type, game_no) {
	window.open("", "todaygame", "width=800, height=850, scrollbars=yes");

	$("#game_type0").val(game_type);
	$("#game_no0").val(game_no);
	$("#GameForm").attr("target", "todaygame");
	$("#GameForm").attr("action", "/game/pop_todaygame.asp");
	$("#GameForm").submit();
}

// 문자중계
function goLive(game_type, game_no) {
	window.open("", "Live", "width=950, height=860");

	$("#game_type0").val(game_type);
	$("#game_no0").val(game_no);
	$("#GameForm").attr("target", "Live");
	$("#GameForm").attr("action", "/live11/realtime2.asp");
	$("#GameForm").submit();
}


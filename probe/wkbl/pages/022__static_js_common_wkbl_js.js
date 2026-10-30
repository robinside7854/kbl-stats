<!-- https://www.wkbl.or.kr/static/js/common_wkbl.js -->
// jquery 공백 제거
function TrimStr(Arg) {
	if(Arg != "undefined" && Arg != undefined) {
		var returnArg = Arg.replace(/^\s+|\s+$/g, "");
		return returnArg;
	}
}

// 숫자만 입력, 나머지 문자 자동으로 삭제
function onlyNum(obj) {
	var num_regx = /^[0-9]*$/;
	if( !num_regx.test(obj.value) ) {
		alert("숫자만 입력할 수 있습니다.");
    	obj.value = "";
    }
}

// 영문, 숫자만 입력되는 기능 / 나머지 문자 자동으로 삭제
function keyType(obj, event) {
	if (!(event.keyCode >=37 && event.keyCode <= 40)) {
		var inputVal = obj.value;
		obj.value = inputVal.replace(/[^a-z0-9]/gi, '');
   }
}

// 공통 / ojb : input id / len : 길이 체크할 경우
function fnChkCommon(obj, txt, len) {
	var Arg = TrimStr($("#" + obj).val());
	if(len > 0) var Arg_len = TrimStr($("#" + obj).val()).length;

	if(Arg == "" || (len > 0 && Arg_len < len)) {
		alert(txt + " 입력해 주십시오.");
		$("#" + obj).val("");
		$("#" + obj).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}

function fnChkCommonEng(obj, txt, txt_en, len, lang) {
	var Arg = TrimStr($("#" + obj).val());
	if(len > 0) var Arg_len = TrimStr($("#" + obj).val()).length;

	if(Arg == "" || (len > 0 && Arg_len < len)) {

		if(lang == "kr") {
			alert(txt + " 입력해 주십시오.");
		}else{
			alert("Please enter " + txt_en);
		}

		$("#" + obj).val("");
		$("#" + obj).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}

// 아이디중복체크
function idOverCheck(chkId) {
	var regExp = /^[a-zA-Z0-9!]{6,12}$/;
	if (!regExp.test(chkId) || /[^a-z0-9]+|^([a-z]+|[0-9]+)$/i.test(chkId)) {
		alert("아이디는 영문 숫자 조합, 6-12자 이내로 입력해 주십시오.");
		$("#user_id").val("");
		$("#user_id").focus();
		return false;
	}

	$.ajax({
		type : "post",
		url : "/member/inc/id_overlap_chk.asp",
		dataType : "text",
		timeout : 15000,
		cache : false,
		data : { "chkId" : chkId },
		success : function(result) {
			if(result == 0) {
				alert("사용 가능한 아이디입니다.");
				$("#password").focus();
				$("#idOverChk").val("Y");
			} else {
				alert("이미 사용중인 아이디입니다.");
				$("#user_id").val("");
				$("#user_id").focus();
				$("#idOverChk").val("N");
				return;
			}
		},
		error : function(e) {
			alert("오류가 발생했습니다.\n관리자에게 문의해 주십시오.");
		}
	});
}


// 비밀번호 필수 입력 + 형식 체크
function fnChkPw(str, txt, Val) {
	//var regExp = /^[a-zA-Z0-9!]{6,20}$/;		// 영문 숫자
	var regExp = /^(?=.*[a-zA-Z])(?=.*[!@#$%^&*+=-])(?=.*[0-9]).{6,20}$/;	// 영문 숫자 특수문자
	//var regExp = /^(?=.*[a-zA-Z])(?=.*[~!@#$%^&*()_+|<>?:{}])(?=.*[0-9]).{6,20}$/;	// 영문 숫자 특수문자

	//if (!regExp.test(Val) || /[^a-z0-9]+|^([a-z]+|[0-9]+)$/i.test(Val)) {
	if (!regExp.test(Val)) {
		alert(txt + " 영문 숫자 특수문자 조합, 6-20자 이내로 입력해 주십시오.");
		$("#" + str).val("");
		$("#" + str).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}

function fnChkPwEng(str, txt, txt_en, Val, lang) {
	//var regExp = /^[a-zA-Z0-9!]{6,20}$/;		// 영문 숫자
	var regExp = /^(?=.*[a-zA-Z])(?=.*[!@#$%^&*+=-])(?=.*[0-9]).{6,20}$/;	// 영문 숫자 특수문자
	//var regExp = /^(?=.*[a-zA-Z])(?=.*[~!@#$%^&*()_+|<>?:{}])(?=.*[0-9]).{6,20}$/;	// 영문 숫자 특수문자

	//if (!regExp.test(Val) || /[^a-z0-9]+|^([a-z]+|[0-9]+)$/i.test(Val)) {
	if (!regExp.test(Val)) {
		if(lang == "kr") {
			alert(txt + " 영문 숫자 특수문자 조합, 6-20자 이내로 입력해 주십시오.");
		}else{
			alert(txt_en + " is 6 – 20 characters, including letters numbers, and symbols (!@$%^*)");
		}


		$("#" + str).val("");
		$("#" + str).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}

// 이메일주소 필수 입력 + 형식 체크
function fnChkEmail(str, email1, email2) {
	// var regExp = /^[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*\.[a-zA-Z]{2,3}$/i;
	var regExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i;
	if (!regExp.test(email1 + "@" + email2)) {
		alert("이메일주소를 정확하게 입력해 주십시오.");
		$("#" + str).val("");
		$("#" + str).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}

function fnChkEmail_v2(str, email1) {
	// var regExp = /^[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*\.[a-zA-Z]{2,3}$/i;
	var regExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i;
	if (!regExp.test(email1)) {
		alert("이메일주소를 정확하게 입력해 주십시오.");
		$("#" + str).val("");
		$("#" + str).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}

function fnChkEmail_v2_eng(str, email1, lang) {
	// var regExp = /^[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*\.[a-zA-Z]{2,3}$/i;
	var regExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i;
	if (!regExp.test(email1)) {
		if(lang == "kr") {
			alert("이메일주소를 정확하게 입력해 주십시오.");
		}else{
			alert("Please enter your email address correctly.");
		}

		$("#" + str).val("");
		$("#" + str).focus();
		var returnArg = "N";
	} else {
		var returnArg = "Y";
	}
	return returnArg;
}





// 뉴스 외부 링크 새창 클릭
function fnNewsLink(num, link) {
	// 조회수 증가
	$.ajax({
		type : "post",
		url : "/news/ajax_news_visited.asp",
		dataType : "text",
		timeout : 15000,
		cache : false,
		data : { "num" : num },
		success : function(result) {
		},
		error : function(e) {
		}
	});

	// 링크 주소로 새 창
	window.open(link);
}



// 새창
function Open_Win(files, name, Width, Height, Scroll) {
	var win_width = (screen.availwidth) / 2 - Math.ceil(Width / 2);
	var win_height = (screen.availheight) / 2 - Math.ceil(Height / 2);
	window.open(files, name, 'menubar=0, status=0, locationbar=0, scrollbars=' + Scroll + ', resizable=0, left=' + win_width + ', top=' + win_height + ', width=' + Width + ', height=' + Height);
}




// *** 모바일 이전 페이지 ***
function MoveBack() {
	history.back();
}
// *** 모바일 이전 페이지 ***



/* function chkPatten(val,patten){
	var regNum =/^[0-9]+$/;
	var regPhone =/^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/;
	var regPost =/^[0-9]{3}-[0-9]{3}/
	var regTel1 =/^[0-9]{2,3}/
	var regTel2 = /^[0-9]{3,4}/
	var regTel3 = /^[0-9]{4}$/;
	var regMail =/^[_a-zA-Z0-9-]+@[._a-zA-Z0-9-]+.[a-zA-Z]+$/;
	var regDomain =/^[.a-zA-Z0-9-]+.[a-zA-Z]+$/;
	var regAlpha =/^[a-zA-Z]+$/;
	var regHost =/^[a-zA-Z-]+$/;
	var regHangul =/[가-힣]/;
	var regHangulEng =/[가-힣a-zA-Z]/;
	var regHangulEngNum =/[가-힣a-zA-Z0-9]/;
	var regHangulOnly =/^[가-힣]*$/;
	var regId = /^[a-zA-Z0-9_-]{1}[a-zA-Z0-9_-]{3,11}$/;
	var regPw = /^[a-zA-Z0-9]{1}[a-zA-Z0-9_-]{3,11}$/;
	var regDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

	patten = eval(patten);
	if(!patten.test(val)){
		return false;
	}
	return true;
}

function CheckEmail(strEmail){
  var regDoNot = /(@.*@)|(\.\.)|(@\.)|(\.@)|(^\.)/;
  var regMust = /^[a-zA-Z0-9\-\.\_]+\@[a-zA-Z0-9\-\.]+\.([a-zA-Z]{2,4})$/;
  if ( !regDoNot.test(strEmail) && regMust.test(strEmail) )
    return true;
  else
	  return false;
} */
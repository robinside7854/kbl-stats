<!-- https://www.wkbl.or.kr/static/js/ui_24.js?ver=2.2 -->
(function($, $document, $window){

	var ui = {};

	ui.pageSet = {
		init : function(){
			this.contentTab();
			this.scrollTop();
			//this.vodLayer();
			this.contentHeight();
			this.selectBoxSet();
			this.contentOnePageTab();
			this.selectBoxUi();
            this.selectTeamUi();
            if($('#cMain').hasClass('allstar') || $('#cMain').hasClass('event_wish')){
				//
			} else {
				this.uiCheckCtrl();
			}
            this.customScrollSet();
            this.teamHistorySet();
            this.SelectMailEvent();
			if(BrowserCheck()==7 || BrowserCheck()==8){
				$('html').addClass('is_ie');
                $('.post_header .template_blur, .post_header .bg_blur').remove();
			}
            if(BrowserCheck()==7 || BrowserCheck()==8 || BrowserCheck()==9){
                $('input, textarea').placeholder();
            }
		},
		contentTab : function(){
		    var $btn = $('.js_tab li > a'),
		    	sticky = '.breadcrumb_block',
		    	$stickyHeight = $(sticky).outerHeight();
		    	speed = 280;

		    $btn.click(function(){
		    	var offset = $(this).offset().top;
		    	var $dataTarget = $(this).attr('data-target');
		    	if($dataTarget){
			    	$btn.removeClass('on');
		    		$(this).addClass('on');
		    		if($(this).hasClass('on')==true){
		    			$('.tabs_container .wrap_tab').removeClass('on');
				    	$('#'+$dataTarget).addClass('on');
		    		}
		    	}
		    	if ($(sticky).hasClass('sticky_on')){
		    		$('body, html').animate({scrollTop: offset - $stickyHeight}, speed);
		    	} else {
		    		//$('body, html').animate({scrollTop: offset - ($stickyHeight)}, speed);
		    	}
		    	return false;
		    });
		},
		contentOnePageTab : function(){
			var $btn = $('.js_tab_one');

			$btn.click(function(){
				var $dataTarget = $(this).attr('data-body'),
					$targetBody = $('.js_body_extend');

				if($dataTarget){
					$(this).parents('ul, div').find('.js_tab_one').removeClass('on');
					$(this).addClass('on');
					$targetBody.removeClass('on');
					$('#'+$dataTarget).addClass('on');

					//***** 경기일정 목록 / 달력
					if($dataTarget == "scheduleBody1") $("#viewType").val("1");
					else $("#viewType").val("2");
					//***** 경기일정 목록 / 달력
				}

				fnTrade($(this).attr('data-gbn'));	// /player/trade_info.asp

				return false;
			});
		},
		vodLayer : function(){
			$(".js_layer").click(function(){
				$dataTarget = $(this).attr('data-target');				
				$('#'+$dataTarget).stop().fadeIn('fast');
				$("body").addClass("popup_open");
				if($dataTarget == "layerVod"){
					$('.wrap_layer .frame_vod').append('<iframe width="1200" height="675" src="https://www.youtube.com/embed/0xu3Etz7vI0?autoplay=1" frameborder="0" allowfullscreen></iframe>');
				}
			});
			$('.wrap_layer .btn_close').click(function(){
				if($("body").hasClass('popup_open')){
					if($(this).parents('#layerVod')){
						$(".wrap_layer .frame_vod").empty();
					}
					$('#'+$dataTarget).stop().fadeOut('fast');
					$("body").removeClass("popup_open");
				}
			});
		},
		scrollTop : function(){
			var $body = $(document.body);
		    var speed = 200; // 스크롤속도
		    var $top = '';

		    $top=$('<div>').addClass('btn_top').addClass('ico_comm').html("위로가기").appendTo($body);

		    $(window).scroll(function(){
		        var y = $(this).scrollTop();
		        if(y >= 200){
		            $(".btn_top").addClass("on");
		        }
		        else {
		           $(".btn_top").removeClass("on");
		        }
		    });

		    $(".btn_top").click(function(){
		        $('body, html').animate({scrollTop:0}, speed);
		    });
		},
		contentHeight : function(){
			var target = '#siteWrap',
				$winHeight = $(window).height()
			$(target).css({
				minHeight: $winHeight+"px"
			})
		},
		selectBoxSet : function(){
			var $select = $(".opt_item .opt_select");
			var $selectDis = $(".opt_item .opt_select:disabled");

		    $select.change(function(){
		        var select_name = $(this).children("option:selected").text();
		        $(this).siblings(".lab_select").text(select_name);
	    	});
			$select.focus(function(){
				$(this).parent().addClass("on");
			});
			$select.focusout(function(){
				$(this).parent().removeClass("on");
			});
			$selectDis.parent().addClass("opt_disabled");
			$select.each(function(){
				if($(this).children("option:selected")){
					var default_name = $(this).children("option:selected").text();
					$(this).siblings(".lab_select").text(default_name);
				}
			});
		},
		selectBoxUi : function(){
			var optBox = '.opt_box',
				bt = '.btn_opt',
				listBox = '.wrap_opt',
				closeBt = '.wrap_opt .btn_close',
                listLink = '.list_opt > li > a';

            var speed = 200; // 스크롤속도

			$('body').on('click', bt, function(){
				if($(this).parent(optBox).hasClass('is_active')){
					$(this).parent(optBox).removeClass('is_active');
					$(this).siblings(listBox).slideUp("fast");
				} else {
					$(this).parent(optBox).addClass('is_active');
					$(this).siblings(listBox).slideDown("fast");
				}
			});
			$('body').on('click', closeBt, function(){
				$(this).parents(optBox).removeClass('is_active');
				$(this).parents(listBox).slideUp("fast");
			});

            $('body').on('click', listLink, function(){
                var ele = '.sort_block',
                    offset = $(ele).offset().top;
                $(listLink).removeClass('active');
                $(this).parents(optBox).removeClass('is_active');
				$(this).parents(listBox).slideUp("fast");
                //$('body, html').animate({scrollTop:offset}, speed);
			});

		},
        // email 주소 입력 ui
		SelectMailEvent : function(){
			var selectBox = '.entry_mail .opt_item',
				target = '.entry_mail .url_mail';
			$(selectBox).change(function(){
				var selectVal = $(selectBox+' option:selected').val();
	        	if(!selectVal) {
	        		$(target).removeAttr('readonly')
	        			.removeClass('is_disabled')
	        			.val("")
	        			.focus();
	        	}else{
	        		$(target).attr('readonly', 'readonly')
	        			.addClass('is_disabled')
	        			.val(selectVal);
	        	}
	    	});

		},
        uiCheckCtrl : function(){
            $('input:checked').prev().addClass('on');	// 최초 체크된 서식 디자인 적용

            $(document).on('click', 'input.radio, input.check', function(){
				//console.log('test');
                var $that = $(this);
                if ($that.is('.check')){
                    if($that.is(":checked")) $that.prev().addClass('on');
                    else  $that.prev().removeClass('on');
                } else if ($that.is('.radio')) {
                    $('input[name="'+ $that.attr('name') +'"]').each(function() {
                        if (this == $that[0]) $(this).prev().addClass('on');
                        else $(this).prev().removeClass('on');
                    });
                }
            })
            .on('focus', 'input.radio, input.check', function() {
                    if($(this).is(":checked")) $(this).prev().addClass('on');
                    else  $(this).prev().removeClass('on');
            })
            .on('blur', 'input.radio, input.check', function() {
                    if($(this).is(":checked")) $(this).prev().addClass('on');
                    else  $(this).prev().removeClass('on');
            });

            $that = null;
	   },
        selectTeamUi : function(){
            var teamBox = '.select_team',
                bt = '.team_block .btn_team',
                closeBt = '.select_team .btn_close';

            $('body').on('click', bt, function(){
                $(this).blur();
                $(teamBox).slideUp('fast');
                $(this).siblings(teamBox).slideDown('fast');
            });

            $('body').on('click', closeBt, function(){
                $(this).parents(teamBox).slideUp('fast');
            });
        },
        customScrollSet : function(){
            var target = '.scr_area';
            if($(target)){
                $(target).customScrollbar({
                    updateOnWindowResize:true,
                    swipeSpeed:3
                });
            }
        },
        customScrollAfterCheck : function(){
            var target = '.scr_area .scroll-bar';
            $(target).each(function(){
                if($(this).css("display") == "block"){
                    $(this).parent().addClass('scroll_on');
                }
            });

        },
        teamHistorySet : function(){
            var target = '.team__history .list_history li:even';
            $(target).addClass('even');
        }
	},
	ui.sub = {
		onLoadClasshandle: function(){
			var target = '.js_class_once';
			setTimeout(function(){
				$(target).removeClass('off_react');
			}, 500);
		},
		tableColumnActive: function(){
			var td = '.js_column tbody td';
			var th = '.js_column thead th.asc, .js_column thead th.desc';

            var thisIndex = $(th).parents('tr').find('th').index( $(th) );
            $(th+':nth-child(' + (thisIndex+1) + ')').addClass('on');
            $(td+':nth-child(' + (thisIndex+1) + ')').addClass('on');

		},
        SlideDownAnimate: function(href){
            var Positions = $(href).offset().top;
            $("body,html").stop().animate({
                scrollTop : Positions - 151
            },100);
        },
        SlideDownEventLisner: function(){
            $(".js_scroll_slide").click(function(){
                var $href = $(this).attr("href");
                ui.sub.SlideDownAnimate($href);
                if($(this).hasClass('link_order')){
                    $(this).parents('.wrap_order').find('.link_order').removeClass('is_active');
                    $(this).addClass('is_active');

                }
                return false;
            });
        },
        pageAnchorScroll : function(){
        	var btn = '.js_anchor_btn',
        		anchorBody = '.js_anchor_body';

        	$(btn).click(function(){
        		var $href = $(this).attr("href"),
        			$position = $($href).parents(anchorBody).scrollTop() + $($href).offset().top - $($href).parents(anchorBody).offset().top;

        		$(anchorBody).stop().animate({
        			scrollTop: $position
        		}, 400);
        		return false;
        	});
        }
	},
	ui.navigation = {
		init: function(){
			this.fullNavigation();
			this.breadcrumbMenu();
			this.breadcrumbSticky();
			this.utilSearch();
		},
		fullNavigation : function(){
			$('.nav_wrapper').mouseleave(function(){
				$('.nav_wrapper .sub_menu').stop().animate({top:'-390px'}, {duration:200});
				$('#pageGnb .list_menu li').removeClass('active');
			});
			$('#pageGnb .depth1 > a').mouseover(function(){
				var index = $(this).parent().index();
				var navNo = $(this).attr('rel');
				$('#pageGnb li').removeClass('active');
				$(this).parent().addClass('active');
				$('.nav_wrapper .sub_menu .' + navNo).show();
				$('.nav_wrapper .sub_menu').stop().animate({top:'80px'}, {duration:300, easing: "swing"});
				$('.nav_wrapper .sub_menu ul').removeClass('active');
				$('.nav_wrapper .sub_menu ul').eq(index).addClass('active');
			});
			$('.nav_wrapper ul').mouseover(function(){
				var index = $(this).attr('rel');
				$('.nav_wrapper .sub_menu ul').removeClass('active');
				$('#pageGnb > ul > li').removeClass('active');
				$('#pageGnb > ul > li').eq(index).addClass('active');
			});
		},
		breadcrumbMenu : function(){
			var $depth1 = $('.list_breadcrumb .depth1');

			$depth1.mouseover(function(){
	            $(this).addClass('on');
	            $(this).children('.sub_menu').stop().slideDown("fast");
	        });
	        $depth1.mouseleave(function(){
                $(this).removeClass('on');
                $('.list_breadcrumb .sub_menu').stop().slideUp("fast");
            });
		},
		breadcrumbSticky : function(){
			var $breadcrumb = $('.breadcrumb_block'),
				offset = $breadcrumb.offset();
			 if ($(window).scrollTop() > 129){
		        $breadcrumb.addClass("sticky_on");
		    }
		    else{
		        $breadcrumb.removeClass("sticky_on");
		    }
		},
		utilSearch : function(){
			var btn = '.util_wrapper .list_util .btn_search',
				target = '.util_wrapper .wrap_search';
			$(btn).click(function(){
				if($(target).hasClass('on')){
					$(target).removeClass('on').stop().fadeOut('fast','linear');
				} else {
					$(target).addClass('on').stop().fadeIn('fast','linear');
					$(target).find('#search_word').focus();
				}
			});
		},
	},
	ui.toggleDisplay = {
		selector: '.js_toggle_display',
		init: function(){
			var _this = this;
			$document
				.delegate(_this.selector, 'click', function(e){
					var $this = $(this),
						$target = $(this.hash),
						$dataTarget = $this.attr('data-target');

					e.preventDefault();

					if( $this.attr('href') !== undefined ){
						_this.hrefToggle($this, $target);
					} else {
						_this.dataToggle($this, $dataTarget);
					}

					if($dataTarget = 'searchBox'){
						$('#'+$dataTarget).find('.inp_text').focus();
					}
				});
		},
		hrefToggle: function($this, $target){
			if( $this.hasClass('is_active') ){
				$target.slideUp(100);
				$this.removeClass('is_active');
			}else{
				$target.slideDown(100);
				$this.addClass('is_active');
			}
		},
		dataToggle: function($this, $dataTarget){
			if ( $this.hasClass('is_active') ){
				$('#'+$dataTarget).slideUp(100);
				$this.removeClass('is_active');
			}else{
				$('#'+$dataTarget).slideDown(100);
				$this.addClass('is_active');
			}
		}
	}

	$document.ready(function(){
		ui.pageSet.init();
		ui.navigation.init();
        ui.sub.SlideDownEventLisner();
        ui.sub.pageAnchorScroll();

	});

	$(window).on("scroll",function(){
		ui.navigation.breadcrumbSticky();
	});
	$(window).on("resize",function(){
		ui.navigation.breadcrumbSticky();
		ui.pageSet.contentHeight();
	});
	$(window).load(function() {
		ui.sub.onLoadClasshandle();
		ui.sub.tableColumnActive();
        setTimeout(function(){
            ui.pageSet.customScrollAfterCheck();
        }, 500);

	});

	window.ui = ui;

}(jQuery, $(document), $(window)));



function BrowserCheck(){
	var myNav = navigator.userAgent.toLowerCase();
			return (myNav.appName == 'Netscape' && myNav.userAgent.search('Trident') != -1 || myNav.indexOf('msie') != -1) ? parseInt(myNav.split('msie')[1]) : false;
}

function checkspell(){
	var hostName = $(location).attr('pathname');

	var hnSp = hostName.split("/");
	var hostForderName = hnSp[1];

	// 안쓰는곳에서 에러남 예외 2019-12-02
	var depth2 = $('#depth2 .sub_menu li a').attr('href');
	if( depth2 != undefined ) {

		var d2Sp = depth2.split('/');
		var d2Name = d2Sp[1];

		if(hostForderName === d2Name){
			$(this).find('#depthTxt').append(d2Name).css('text-transform','uppercase');	
		}
		
		$('#depth1 li a').removeClass('active');

		if (hostForderName == 'about'){
			$(this).find('#depthTxt').text('WKBL');
			$('#b_wkbl').addClass('active');
		}

		if(hostForderName == 'news'){
			$('#b_news').addClass('active');
			$('#depthTxt').attr('href',"/news/hotfocus_list.asp");
		} else if(hostForderName == 'game'){
			$('#b_game').addClass('active');
			$('#depthTxt').attr('href',"/game/sch/scheduleP1.asp");
		} else if(hostForderName == 'team'){
			$('#b_team').addClass('active');
			$('#depthTxt').attr('href',"/team/teaminfo.asp");
		} else if(hostForderName == 'player'){
			$('#b_player').addClass('active');
			$('#depthTxt').attr('href',"/player/player_list.asp");
		} else if(hostForderName == 'fan'){
			$('#b_fan').addClass('active');
			$('#depthTxt').attr('href',"/fan/board_list.asp");
        } else if(hostForderName == 'ticket'){
            $('#b_fan').addClass('active');
            $('#depthTxt').attr('href',"/fan/board_list.asp");
		}

	}
}
checkspell();

// 기자 프로그램
function MM_openBrWindow(theURL,winName, features) { //v2.0
	window.open(theURL, winName, features);
}
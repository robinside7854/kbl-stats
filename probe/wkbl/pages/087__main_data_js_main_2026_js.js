<!-- https://www.wkbl.or.kr/main/data/js/main_2026.js -->
$(function(){

    //main schedule list
    if(mainMenuOnOff['sch_list'] == 'Y'){
        $.ajax({
            type: "POST",
            dataType: "text",
            url: "/main/data/2026_main_sch.asp",
            contentType : "charset=utf-8",
            success : function(data) {

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //game_slider

                $('.game_slider').html(data);


                // game_slider effect
                $('.game_slider').on('init', function (event, slick) {
                    $('.main_game_list .main_loading').remove();
                    if (slick.slideCount < 2) {
                        $('.main_game_list .slick-arrow').css('display','none');
                    }
                }).slick({
                    slidesToShow: 4,
                    slidesToScroll: 1,
                    variableWidth: true,
                    infinite: false,
                    prevArrow : ".game-slick-prev",
                    nextArrow : ".game-slick-next"
                });


                //티켓예매 팝업 오픈
                $('.btn_popup[data-popup="main_info"]').on('click',function(){
                    $('.popup_wrap .contents_wrap .bottom').animate({scrollTop: '0'}, 1);   // 스크롤 맨위

                    let time = Date.now();
                    let now_lang_popup = localStorage.getItem("lang");
                    let tcode = $(this).data('tcode');
                    let $target = $('.popup_wrap[data-popup="main_info"]');
                    let img = new Image();
                    // img.src = now_lang_popup == 'kr'
                    //     ? '/static/images/ticketing_'+tcode+'.jpg?'+time+''
                    //     : '/static/images/ticketing_'+tcode+'_en.jpg?'+time+'';


                    var img_url = 'https://apps.wkbl.or.kr/static/images/ticketing/';

                    //안내 기본 이미지
                    var default_img = now_lang_popup == 'kr'
                        ? 'ticketing_.jpg?'+time
                        : 'ticketing__en.jpg?'+time;

                    img.src = now_lang_popup == 'kr'
                        ? img_url + 'ticketing_'+tcode+'.jpg?'+time
                        : img_url + 'ticketing_'+tcode+'_en.jpg?'+time;

                    $target.addClass('active');


                    //안내 이미지 팝업
                    img.onload = function () {
                        $target.find('.bottom img').attr('src', img.src);
                        $target.find('.bottom').addClass('active');
                    }

                    //안내 아미지 error
                    img.onerror = function() {
                        $target.find('.bottom img').attr('src', img_url + default_img);
                        $target.find('.bottom').addClass('active');
                    };

                });


                //티켓예매 팝업 닫기
                $('.btn_close').on('click',function(){
                    $('.popup_wrap[data-popup="main_info"]').removeClass('active');
                    $('.popup_wrap[data-popup="main_info"] .bottom').removeClass('active');
                });


                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("status::", jqXHR.status);
                console.log("text:", textStatus, errorThrown);
                console.log("res:", jqXHR.responseText);
            }
        });

    }



    //main cache direct data
    function main_direct_data(){
        $.ajax({
            type: "POST",
            dataType: "json",
            url: "/main/data/2026_main_direct.asp",
            contentType : "application/json",
            success : function(data) {

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // league list title   #league_list_img   #league_list_title

                if(mainMenuOnOff['sch_list'] == 'Y'){
                    $('#league_list_img').html(data.top_league_title.league_img);
                    $('#league_list_title').html(data.top_league_title.league_title);
                    $('#league_list_title').attr('data-kr',data.top_league_title.league_title);
                    $('#league_list_title').attr('data-en',data.top_league_title.league_title_en);
                }


                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //top visual   .main_top_slider
                let top_visual_text = '';
                for(i=0; i < data.top_visual.length; i++){

                    top_visual_text += `<li>
                                             <div class="thumb_img">
                                                 ${data.top_visual[i].re_pop_img}
                                             </div>
                                             <div class="txt_wrap">
                                                 <p class="title">${data.top_visual[i].re_subject}</p>
                                                 ${data.top_visual[i].go}
                                             </div>
                                         </li>`;
                }
                $('.main_top_slider').html(top_visual_text);


                //main visual effect
                var $mainSlider = $('.main_top_slider');

                $mainSlider.on('beforeChange', function (event, slick, currentSlide) {
                    var current = slick.$slides[currentSlide];
                    var focused = document.activeElement;

                    if (current && focused && current.contains(focused)) {
                        focused.blur();
                    }
                });

                $mainSlider.on('init', function (event, slick) {
                    if (slick.slideCount < 2) {
                        $('.main_top_slider .slick-dots').hide();
                    }
                }).slick({
                    autoplay: true,
                    autoplaySpeed: 5000,
                    pauseOnHover: false,
                    fade: true,
                    speed: 2000,
                    infinite: true,
                    slidesToShow: 1,
                    slidesToScroll: 1,
                    arrows: false,
                    dots: true
                });


                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //right event  .main_event_state
                let right_event_text = '';

                if(mainMenuOnOff['event'] == 'Y'){
                    right_event_target = (data.right_event.target == 'Y') ? " target='_blank' " : '';

                    right_event_text = `<div class="tit_box between">
                                             <h2 class="cont_title language" data-kr="이벤트" data-en="Event">이벤트</h2>
                                         </div>
                                         <div class="inbox">
                                             <div class="thumb_img">
                                                 <img src="${data.right_event.img}" alt="event 배너">
                                             </div>
                                             <a href="${data.right_event.link}" ${right_event_target} class="btn language" data-kr="참여하기" data-en="Join Now">참여하기</a>
                                         </div>`;

                    $('.main_event_state').html(right_event_text);
                }

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //right banner  .banner_slider
                let right_banner_text = '';
                for(i=0; i < data.right_banner.length; i++){
                    right_banner_text += `<li>
                                              <a href="${data.right_banner[i].link}" target="_blank">
                                                  <img src="${data.right_banner[i].img}" alt="${data.right_banner.title}">
                                              </a>
                                          </li>`;
                }

                $('.banner_slider').html(right_banner_text);

                // right banner rolling slider
                $('.banner_slider').on('init', function (event, slick) {
                    if (slick.slideCount < 2) {
                        $('.banner_slider .slick-dots').css('display','none');
                    }
                }).slick({
                    autoplay: true,
                    autoplaySpeed: 5000,
                    pauseOnHover: false,
                    speed: 1000,
                    infinite: true,
                    slidesToShow: 1,
                    slidesToScroll: 1,
                    arrows: false,
                    dots: true
                });


                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("status::", jqXHR.status);
                console.log("text:", textStatus, errorThrown);
                console.log("res:", jqXHR.responseText);
            }
        });
    }
    main_direct_data();



    //main cache common data
    function main_common_data(){
        $.ajax({
            type: "POST",
            dataType: "json",
            url: "/main/data/2026_main_common.asp",
            contentType : "application/json",
            success : function(data) {


                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //top dday  .main_aside_dday
                let top_dday_text = '';

                if(mainMenuOnOff['dday'] == 'Y'){
                    top_dday_text = `<div class="top">
                                        <div class="dday_tit">
                                            <span class="tag">D-DAY</span>
                                            <!-- 기준 날짜 -->
                                            <span class="standard">${data.top_dDay.dday}</span>
                                        </div>
                                        <!-- 경기 이름 -->
                                        <p class="tit language" data-kr="${data.top_dDay.title}" data-en="${data.top_dDay.title_en}">${data.top_dDay.title}</p>
                                    </div>

                                    <div class="bottom">
                                        <div class="dday">
                                            <span>D</span>
                                            <!-- D-Day 이후 -->
                                            <span class="sign">${data.top_dDay.buho}</span>
                                            <span class="num">${data.top_dDay.days}</span>
                                        </div>
                                    </div>`;

                    $('.main_aside_dday').html(top_dday_text);
                }


                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //top video  .main_aside_wkbltv
                let top_video_text = '';


                top_video_text = `<p class="title language" data-kr="최신 영상" data-en="Latest Videos">최신 영상</p>

                                  <a class="thumb_img" href="${data.top_video.link}">
                                      <img src="${data.top_video.img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.top_video.subject}">
                                  </a>`;

                $('.main_aside_wkbltv').html(top_video_text);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //top notice  .main_visual_notice2
                let top_notice_text = '';
                for(i=0; i < data.top_notice.length; i++){
                    top_notice_text += `<li>
                                            <a href="${data.top_notice[i].link}">
                                                <!-- 썸네일 -->
                                                <div class="thumb_img">
                                                    <img src="${data.top_notice[i].img}" onerror="this.src='/images/main/img_mainVisualNotice_thumb_img.png'" alt="">
                                                </div>
                                                <div class="txt_wrap">
                                                    <!-- 타이틀 -->
                                                    <p class="title eli-2">${data.top_notice[i].subject}</p>
                                                    <!-- 날짜 -->
                                                    <p class="date">${data.top_notice[i].wdate}</p>
                                                </div>
                                            </a>
                                        </li>`;
                }

                $('.main_visual_notice2').html(top_notice_text);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //center article all  .tab_cont_all
                let center_article_all = '';
                for(i=0; i < data.center_newsAll.length; i++){
                    center_article_all += `<li>
                                               <a href="${data.center_newsAll[i].link}" ${data.center_newsAll[i].target}>
                                                   <div class="thumb_img">
                                                       <img src="${data.center_newsAll[i].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_newsAll[i].subject}">
                                                   </div>
                                                   <span class="tag language" data-kr="${data.center_newsAll[i].part_name}" data-en="${data.center_newsAll[i].part_name_en}">${data.center_newsAll[i].part_name}</span>
                                                   <p class="title eli-2">${data.center_newsAll[i].subject}</p>
                                               </a>
                                           </li>`;
                }

                $('.tab_cont_all').html(center_article_all);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //center article hotfocus  .tab_cont_hotfocus
                let center_article_hotfocus = '';
                for(i=0; i < data.center_newsHotfocus.length; i++){
                    center_article_hotfocus += `<li>
                                                   <a href="${data.center_newsHotfocus[i].link}" >
                                                       <div class="thumb_img">
                                                           <img src="${data.center_newsHotfocus[i].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_newsHotfocus[i].subject}">
                                                       </div>
                                                       <span class="tag language" data-kr="보도자료" data-en="Press Release">보도자료</span>
                                                       <p class="title eli-2">${data.center_newsHotfocus[i].subject}</p>
                                                   </a>
                                               </li>`;
                }

                $('.tab_cont_hotfocus').html(center_article_hotfocus);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


                //center article news  .tab_cont_news
                let center_article_news = '';
                for(i=0; i < data.center_newsNews.length; i++){
                    center_article_news += `<li>
                                                <a href="${data.center_newsNews[i].link}" target="_blank">
                                                    <div class="thumb_img">
                                                        <img src="${data.center_newsNews[i].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_newsNews[i].subject}">
                                                    </div>
                                                    <span class="tag language" data-kr="뉴스" data-en="News">뉴스</span>
                                                    <p class="title eli-2">${data.center_newsNews[i].subject}</p>
                                                </a>
                                            </li>`;
                }

                $('.tab_cont_news').html(center_article_news);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //center video top1  .video_wide
                let center_video_top1_text = '';


                center_video_top1_text = `<a href="${data.center_video[0].link}" class="video">
                                              <div class="inner">
                                                  <div class="thumb_img">
                                                      <img src="${data.center_video[0].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_video[0].subject}">
                                                  </div>
                                                  <!-- 타이틀 1줄 -->
                                                  <div class="txt_wrap">
                                                      <p class="title eli-2">${data.center_video[0].subject}</p>
                                                      <p class="sub_title eli">${data.center_video[0].summary}</p>
                                                      <p class="date">${data.center_video[0].wdate}</p>
                                                  </div>
                                              </div>
                                          </a>`;

                $('.video_wide').html(center_video_top1_text);


                //center video   .video_side
                let center_video_text = '';
                for(i=1; i < data.center_video.length; i++){
                    center_video_text += `<div class="inbox">
                                              <a href="${data.center_video[i].link}" class="video">
                                                  <div class="thumb_img">
                                                      <img src="${data.center_video[i].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_video[i].subject}">
                                                  </div>
                                                  <!-- 타이틀 1줄 -->
                                                  <div class="txt_wrap">
                                                      <p class="title eli">${data.center_video[i].subject}</p>
                                                      <p class="date">${data.center_video[i].wdate}</p>
                                                  </div>
                                              </a>
                                          </div>`;
                }

                $('.video_side').html(center_video_text);
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //center short   .shorts_wrap
                for(i=0; i < data.center_short.length; i++){
                    shortsList.push(data.center_short[i].youtube_link);
                }

                let center_short_text = '';
                for(i=0; i < data.center_short.length; i++){
                    center_short_text += `<div class="inbox">
                                              <a href="javascript:void(0);" class="short" data-index="0" onclick="openShortsModal(${i}); return false;">
                                                  <div class="thumb_img">
                                                      <img src="${data.center_short[i].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_short[i].title}">
                                                  </div>
                                                  <p class="title eli-2">${data.center_short[i].title}</p>
                                              </a>
                                          </div>`;
                }

                $('.shorts_wrap').html(center_short_text);
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //center photo   .photo_wrap
                let center_photo_text = '';
                for(i=0; i < data.center_photo.length; i++){
                    center_photo_text += `<div class="inbox">
                                              <a href="${data.center_photo[i].link}">
                                                  <div class="thumb_img">
                                                      <img src="${data.center_photo[i].img}" onerror="this.src='/static/images/main/error_image.png'" alt="${data.center_photo[i].subject}">
                                                  </div>
                                                  <p class="title eli-2">${data.center_photo[i].subject}</p>
                                              </a>
                                          </div>`;
                }

                $('.photo_wrap').html(center_photo_text);
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                //right round   .round_select  .round_mvp_cont
                round_mvp = data.right_mvp;

                $(".round_select option").remove();
                for(i=0; i<round_mvp.length;i++){
                    $('.round_select').append(`<option value="${i}">${round_mvp[i].round}Round</option>`);
                }


                let right_round_text = '';

                if(mainMenuOnOff['round_mvp'] == 'Y'){

                    if(round_mvp[0]){
                        right_round_text = `<li>
                                                <div class="top">
                                                    <p class="tit">MVP</p>
                                                    <div class="player_info">
                                                        <img src="/static/images/team/teamlogo_${round_mvp[0].mvp.team_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[0].mvp.team_name}">
                                                        <p class="name language" data-kr="${round_mvp[0].mvp.name}" data-en="${round_mvp[0].mvp.name_en}">${round_mvp[0].mvp.name}</p>
                                                    </div>
                                                </div>
                                                <div class="mvp_info">
                                                    <div class="thumb_img">
                                                        <img src="/static/images/player/pimg/np_${round_mvp[0].mvp.player_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[0].mvp.name}">
                                                    </div>
                                                    <ul class="data">
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>득점" data-en="<span class='point_box'></span>Points"><span class="point_box"></span>득점</p>
                                                            <p>${round_mvp[0].mvp.point}</p>
                                                        </li>
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>리바운드" data-en="<span class='point_box'></span>Rebounds"><span class="point_box"></span>리바운드</p>
                                                            <p>${round_mvp[0].mvp.rebound}</p>
                                                        </li>
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>어시스트" data-en="<span class='point_box'></span>Assists"><span class="point_box"></span>어시스트</p>
                                                            <p>${round_mvp[0].mvp.assist}</p>
                                                        </li>
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>스틸" data-en="<span class='point_box'></span>Steals"><span class="point_box"></span>스틸</p>
                                                            <p>${round_mvp[0].mvp.steal}</p>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </li>
                                            <li>
                                                <div class="top">
                                                    <p class="tit">MIP</p>
                                                    <div class="player_info">
                                                        <img src="/static/images/team/teamlogo_${round_mvp[0].mip.team_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[0].mip.team_name}">
                                                        <p class="name language" data-kr="${round_mvp[0].mip.name}" data-en="${round_mvp[0].mip.name_en}">${round_mvp[0].mip.name}</p>
                                                    </div>
                                                </div>
                                                <div class="mvp_info">
                                                    <div class="thumb_img">
                                                        <img src="/static/images/player/pimg/np_${round_mvp[0].mip.player_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[0].mip.name}">
                                                    </div>
                                                    <ul class="data">
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>득점" data-en="<span class='point_box'></span>Points"><span class="point_box"></span>득점</p>
                                                            <p>${round_mvp[0].mip.point}</p>
                                                        </li>
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>리바운드" data-en="<span class='point_box'></span>Rebounds"><span class="point_box"></span>리바운드</p>
                                                            <p>${round_mvp[0].mip.rebound}</p>
                                                        </li>
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>어시스트" data-en="<span class='point_box'></span>Assists"><span class="point_box"></span>어시스트</p>
                                                            <p>${round_mvp[0].mip.assist}</p>
                                                        </li>
                                                        <li>
                                                            <p class="language" data-kr="<span class='point_box'></span>스틸" data-en="<span class='point_box'></span>Steals"><span class="point_box"></span>스틸</p>
                                                            <p>${round_mvp[0].mip.steal}</p>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </li>`;
                    }

                    $('.round_mvp_cont').html(right_round_text);
                }
                ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("status::", jqXHR.status);
                console.log("text:", textStatus, errorThrown);
                console.log("res:", jqXHR.responseText);
            }
        });
    }
    main_common_data();





    //main cache record data
    function main_record_data(){
        let loader = '<li class="main_loading"><div class="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></li>';

        $('.player_ranking_list').append(loader);
        $('#right_team_ranking').append(loader);
        $('#main_team_graph').append(loader);

        $.ajax({
            type: "POST",
            dataType: "json",
            url: "/main/data/2026_main_record.asp",
            contentType : "application/json",
            success : function(data) {

                //season name
                $('.season_name_result').html(`${data.seasonName} 시즌 집계결과`);
                $('.season_name_result').attr('data-kr',`${data.seasonName} 시즌 집계결과`);
                $('.season_name_result').attr('data-en',`${data.seasonName} Season Results`);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //center player rank   .main_player_rainking  .player_ranking_list
                let center_player_rank_text = '';

                if(mainMenuOnOff['player_rank'] == 'Y'){

                    if(Object.keys(data.playerRank).length == 0){
                        center_player_rank_text = `<li class="no_data">
                                                       <img src="/static/images/main/none_data_player_part_list.png" alt="선수 데이터 없음">
                                                   </li> `;
                    }else{

                        for(i=0; i < data.playerRank.length; i++){
                            center_player_rank_text += `<li>
                                                            <div class="top_ranker">
                                                                <p class="sector language" data-kr="${data.playerRank[i].part_name}" data-en="${data.playerRank[i].part_name_en}">${data.playerRank[i].part_name}</p>
                                                                <div class="img_wrap">
                                                                    <div class="thumb_img player">
                                                                        <img src="/static/images/player/pimg/np_${data.playerRank[i].data[0].player_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${data.playerRank[i].data[0].team_name}">
                                                                    </div>
                                                                    <div class="thumb_img team">
                                                                        <img src="/static/images/team/teamlogo_${data.playerRank[i].data[0].team_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${data.playerRank[i].data[0].team_name}">
                                                                    </div>
                                                                </div>
                                                                <div class="info">
                                                                    <p class="rank">${data.playerRank[i].data[0].rank}</p>
                                                                    <div class="inner">
                                                                        <p class="name language" data-kr="${data.playerRank[i].data[0].name}" data-en="${data.playerRank[i].data[0].name_en}" >${data.playerRank[i].data[0].name}</p>
                                                                        <p class="num">${data.playerRank[i].data[0].point}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div class="section etc">
                                                                <p class="rank">${data.playerRank[i].data[1].rank}</p>
                                                                <div class="inner">
                                                                    <div class="player_info">
                                                                        <p class="name language" data-kr="${data.playerRank[i].data[1].name}" data-en="${data.playerRank[i].data[1].name_en}" >${data.playerRank[i].data[1].name}</p>
                                                                        <div class="thumb_img team">
                                                                            <img src="/static/images/team/teamlogo_${data.playerRank[i].data[1].team_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${data.playerRank[i].data[1].team_name}">
                                                                        </div>
                                                                    </div>
                                                                    <p class="num">${data.playerRank[i].data[1].point}</p>
                                                                </div>
                                                            </div>
                                                            <div class="third etc">
                                                                <p class="rank">${data.playerRank[i].data[2].rank}</p>
                                                                <div class="inner">
                                                                    <div class="player_info">
                                                                        <p class="name language" data-kr="${data.playerRank[i].data[2].name}" data-en="${data.playerRank[i].data[2].name_en}" >${data.playerRank[i].data[2].name}</p>
                                                                        <div class="thumb_img team">
                                                                            <img src="/static/images/team/teamlogo_${data.playerRank[i].data[2].team_code}.png" alt="하나은행">
                                                                        </div>
                                                                    </div>
                                                                    <p class="num">${data.playerRank[i].data[2].point}</p>
                                                                </div>
                                                            </div>
                                                        </li>`;

                        }
                    }


                    $('.player_ranking_list').html(center_player_rank_text);
                }



                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // right team rank  #right_team_ranking #right_team_ranking_season
                let right_team_rank_text = '';

                if(mainMenuOnOff['team_rank'] == 'Y'){

                    if(Object.keys(data.teamRank).length == 0){
                        right_team_rank_text = `<tr class="no_data">
                                                    <td colspan="7"><img src="/static/images/main/none_data_player_list.png" alt="선수 데이터 없음"></td>
                                               </tr>`;
                    }else{
                        for(i=0; i < data.teamRank.length; i++){
                            first_class = (data.teamRank[i].rank == 1) ? 'fst' : '';

                            right_team_rank_text += `<tr>
                                                         <td><span class="${first_class}">${data.teamRank[i].rank}</span></td>
                                                         <td class="tlogo">
                                                             <div class="thumb_img">
                                                                 <img src="/static/images/team/teamlogo_${data.teamRank[i].team_code}.png" alt="KB스타즈">
                                                             </div>
                                                             <span class="language" data-kr="${data.teamRank[i].team_name}" data-en="${data.teamRank[i].team_name_en}">${data.teamRank[i].team_name}</span>
                                                         </td>
                                                         <td>${data.teamRank[i].game_cnt}</td>
                                                         <td>${data.teamRank[i].win}</td>
                                                         <td>${data.teamRank[i].loss}</td>
                                                         <td>${data.teamRank[i].win_rate}</td>
                                                     </tr>`;
                        }

                    }

                    $('#right_team_ranking').html(right_team_rank_text);
                }

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                // right team rank part  .team_ranking_select    #main_team_graph

                if(mainMenuOnOff['team_rank_part'] == 'Y'){
                    let right_team_rank_part_text = '';

                    if(Object.keys(data.teamRankPart).length == 0){
                        $(".gragh_wrapper .graph_wrap").removeClass('graph_wrap');

                        right_team_rank_part_text = `<li class="no_data">
                                                         <img src="/static/images/main/none_data_player_list.png" alt="선수 데이터 없음">
                                                    </li>`;
                        $(".team_ranking_select").remove();
                    }else{
                        team_rank_part = data.teamRankPart;

                        $(".team_ranking_select option").remove();
                        for(i=0; i<team_rank_part.length;i++){
                            $('.team_ranking_select').append(`<option value="${i}" class="language" data-kr="${team_rank_part[i].name}" data-en="${team_rank_part[i].name_en}">${team_rank_part[i].name}</option>`);
                        }


                        for(i=0; i < team_rank_part[0].data.length; i++){
                            right_team_rank_part_text += `<li>
                                                              <div class="graph">
                                                                  <div class="rect">
                                                                      <div class="inner" style="height:${team_rank_part[0].data[i].pp}%;">
                                                                          <span class="ani">
                                                                              <div class="inner">
                                                                                  <div class="num">${team_rank_part[0].data[i].point}</div>
                                                                              </div>
                                                                          </span>
                                                                      </div>
                                                                  </div>
                                                              </div>

                                                              <p class="tname"><img src="/static/images/team/teamlogo_${team_rank_part[0].data[i].team_code}.png" alt="${team_rank_part[0].data[i].team_name}"></p>
                                                          </li>`;
                        }

                    }

                    $('#main_team_graph').html(right_team_rank_part_text);
                }
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("status::", jqXHR.status);
                console.log("text:", textStatus, errorThrown);
                console.log("res:", jqXHR.responseText);
            }
        });
    }
    main_record_data();



    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



    // 종합 소식 - 리뉴얼
    $('.main_news_wrap').each(function () {
        var $wrap = $(this);

        $wrap.find('.tab_menu button').on('click', function () {
            var $tab = $(this).closest('li');
            if ($tab.hasClass('active')) return;

            var index = $tab.index();
            $wrap.find('.tab_menu li').removeClass('active').eq(index).addClass('active');
            $wrap.find('.tab_cont').hide().eq(index).show();
        });
    });




    //팀 순위 그래프 실행 모션
    let winTop = $(window).scrollTop();
    function teamRankingGrahpActive(top){
        let sTop = top;
        let cTop = $('.team_ranking_grahp').offset().top - $(window).height() + 200;
        if( sTop > cTop ){
            $(".graph_wrap").addClass("active");
        }
    }
    teamRankingGrahpActive(winTop);

    //팀 순위 탭메뉴 클릭시 초기화 및 재실행
    $('.team_ranking_grahp .team_ranking_select').on('change', function () {
        right_team_rank_part_select_change($(this).val()); //팀부문별 기록 data 호출

        $(".graph_wrap").removeClass("active");
        setTimeout(()=>{
            $(".graph_wrap").addClass("active");
        },100);
    });


    //right team rank part select change
    function right_team_rank_part_select_change(_val){

        let right_team_rank_part_text = '';

        for(i=0; i < team_rank_part[_val].data.length; i++){
            right_team_rank_part_text += `<li>
                                             <div class="graph">
                                                 <div class="rect">
                                                     <div class="inner" style="height:${team_rank_part[_val].data[i].pp}%;">
                                                         <span class="ani">
                                                             <div class="inner">
                                                                 <div class="num">${team_rank_part[_val].data[i].point}</div>
                                                             </div>
                                                         </span>
                                                     </div>
                                                 </div>
                                             </div>

                                             <p class="tname"><img src="/static/images/team/teamlogo_${team_rank_part[_val].data[i].team_code}.png" alt="${team_rank_part[_val].data[i].team_name}"></p>
                                         </li>`;
        }

        $('#main_team_graph').html(right_team_rank_part_text);
    }



    //right round mvp select change
    $('.round_select').change(function() {
        var _val = $(this).val();

        let right_round_text = '';

        right_round_text = `<li>
                               <div class="top">
                                   <p class="tit">MVP</p>
                                   <div class="player_info">
                                       <img src="/static/images/team/teamlogo_${round_mvp[_val].mvp.team_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[_val].mvp.team_name}">
                                       <p class="name language" data-kr="${round_mvp[_val].mvp.name}" data-en="${round_mvp[_val].mvp.name_en}">${round_mvp[_val].mvp.name}</p>
                                   </div>
                               </div>
                               <div class="mvp_info">
                                   <div class="thumb_img">
                                       <img src="/static/images/player/pimg/np_${round_mvp[_val].mvp.player_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[_val].mvp.name}">
                                   </div>
                                   <ul class="data">
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>득점" data-en="<span class='point_box'></span>Points"><span class="point_box"></span>득점</p>
                                           <p>${round_mvp[_val].mvp.point}</p>
                                       </li>
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>리바운드" data-en="<span class='point_box'></span>Rebounds"><span class="point_box"></span>리바운드</p>
                                           <p>${round_mvp[_val].mvp.rebound}</p>
                                       </li>
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>어시스트" data-en="<span class='point_box'></span>Assists"><span class="point_box"></span>어시스트</p>
                                           <p>${round_mvp[_val].mvp.assist}</p>
                                       </li>
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>스틸" data-en="<span class='point_box'></span>Steals"><span class="point_box"></span>스틸</p>
                                           <p>${round_mvp[_val].mvp.steal}</p>
                                       </li>
                                   </ul>
                               </div>
                           </li>
                           <li>
                               <div class="top">
                                   <p class="tit">MIP</p>
                                   <div class="player_info">
                                       <img src="/static/images/team/teamlogo_${round_mvp[_val].mip.team_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[_val].mip.team_name}">
                                       <p class="name language" data-kr="${round_mvp[_val].mip.name}" data-en="${round_mvp[_val].mip.name_en}">${round_mvp[_val].mip.name}</p>
                                   </div>
                               </div>
                               <div class="mvp_info">
                                   <div class="thumb_img">
                                       <img src="/static/images/player/pimg/np_${round_mvp[_val].mip.player_code}.png" onerror="this.src='/static/images/main/error_image.png'" alt="${round_mvp[_val].mip.name}">
                                   </div>
                                   <ul class="data">
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>득점" data-en="<span class='point_box'></span>Points"><span class="point_box"></span>득점</p>
                                           <p>${round_mvp[_val].mip.point}</p>
                                       </li>
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>리바운드" data-en="<span class='point_box'></span>Rebounds"><span class="point_box"></span>리바운드</p>
                                           <p>${round_mvp[_val].mip.rebound}</p>
                                       </li>
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>어시스트" data-en="<span class='point_box'></span>Assists"><span class="point_box"></span>어시스트</p>
                                           <p>${round_mvp[_val].mip.assist}</p>
                                       </li>
                                       <li>
                                           <p class="language" data-kr="<span class='point_box'></span>스틸" data-en="<span class='point_box'></span>Steals"><span class="point_box"></span>스틸</p>
                                           <p>${round_mvp[_val].mip.steal}</p>
                                       </li>
                                   </ul>
                               </div>
                           </li>`;


        $('.round_mvp_cont').html(right_round_text);
    });




    //스크롤 이벤트
    $(window).scroll(function(){
        let top = $(this).scrollTop();
        teamRankingGrahpActive(top);
    });


});



//상단 선수 검색
function main_player_top_serch(_val){
    location.href = "/player/search_result.asp?search_team=&search_word=" + encodeURI(_val)
}
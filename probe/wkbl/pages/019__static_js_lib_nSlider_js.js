<!-- https://www.wkbl.or.kr/static/js/lib/nSlider.js -->
/*
 * nSlider.js (http://nslider.com)
 * Version: 1.1703
 * Author: nslider.dev@gmail.com
 * Author URL: http://nslider.com

 * Made available under a MIT License:
 * http://www.opensource.org/licenses/mit-license.php

 * Copyright 2017.All Rights reserved by nslider.dev@gmail.com
 */

// NP global object check
if (!window.NP) {
    var NP = {};
}

//NP.setSlider object check
if (!NP.Slider) {
    NP.Slider = (function() {
        var slider = {}, resizing = {};
        
        //create new slider array
        var createSliderArray = function() {
            var a = arguments, i, l1 = arguments.length;
            
            for (i = 0; i < l1; i++) {
                slider[a[i].id] = {
                    state: {
                        id: a[i].id
                    },
                    element: {},
                    size: {},
                    code: {},
                };
                
                recordCSS(a[i].id);
                recordSize(a[i].id, a[i]);
                recordCode(a[i].id, a[i].code);
                recordEvent(a[i].id, a[i]);
                createFrame(a[i].id, a[i].id);
                setEvent(a[i].id);
                addResize();

                //if autoplay code is enable, start autoplay
                if (slider[a[i].id].code.autoplay === 1) {
                    (function() {
                        var x = a[i].id;
                        slider[x].state.setTimeoutValue = setTimeout(function() {autoPlay(x);}, slider[x].code.term);
                    }());
                }
            }
        }
        
        //record defaultcss
        var recordCSS = function(id) {
            var x, y;
            //If css has not been created yet.
            if (!document.querySelector('#nSliderDefaultCSS')) {
                x = document.createElement('style');
                x.setAttribute('id', 'nSliderDefaultCSS');
                x.setAttribute('type', 'text/css');
                y = '.nSlider {position: relative; width: 100%} .nSlider .sWrap {position: relative; margin: auto; width: 100%; z-index: 1} .nSlider .prevBtn {position: absolute} .nSlider .nextBtn {position: absolute} .nSlider .carousel {position: absolute} .nSlider .conBtn {position: absolute; z-index: 1} .nSlider .sBg {position: absolute; top: 0; width: 100%; height: 100%; overflow: hidden} .nSlider .sBg li {position: absolute; width: 100%; height: 100%} .nSlider .' + id + ' {position: relative; width: 100%; height: 100%; overflow: hidden} .nSlider .' + id + '>li {position: absolute; width: 100%; height: 100%}';
                
                //For IE 11+
                if (typeof x.styleSheet === 'undefined') x.innerHTML = y;
                //For IE 10-
                else x.styleSheet.cssText = y;
                document.getElementsByTagName('head')[0].appendChild(x);
            }
            else {
                x = document.querySelector('#nSliderDefaultCSS');
                y = ' .nSlider .' + id + ' {position: relative; width: 100%; height: 100%; overflow: hidden} .nSlider .' + id + '>li {position: absolute; width: 100%; height: 100%}';
                //For IE 11+
                if (typeof x.styleSheet === 'undefined') x.innerHTML += y;
                //For IE 10-
                else x.styleSheet.cssText += y;
            }
            
            x = y = null;
        }
        
        //record user slide size
        var recordSize = function(i, val) {
            var itSi = slider[i].size;
            
            //if absolute value
            if (!isNaN(val.width) && !isNaN(val.height)) {
                itSi.width = val.width;
                itSi.height = val.height;
                itSi.ratio = val.height / val.width;
            }
            
            //if relative value
            else if (val.ratio) {
                var x = val.ratio.split(':');
                if (!isNaN(x[1] / x[0])) {
                   itSi.ratio = x[1] / x[0];
                }
            }
        }
        
        //record user slider code
        var recordCode = function(i, val) {
            var itC = slider[i].code, itSt = slider[i].state;
            //animation
            if (val && 0 <= val.animation && val.animation <= 3) {
                itC.animation = val.animation * 1;
                itSt.animation = 0;
            } else {
                itC.animation = 1;
                itSt.animation = 0;
            }
            //bgAnimation
            if (val && 0 <= val.bgAnimation && val.bgAnimation <= 2) itC.bgAnimation = val.bgAnimation * 1;
            else itC.bgAnimation = 1;
            //duration
            if (val && 100 <= val.duration && !isNaN(val.duration)) itC.duration = val.duration * 1;
            else itC.duration = 200;
            //autoplay
            if (val && 0 <= val.autoplay && val.autoplay <= 1) {
                itC.autoplay = val.autoplay;
                itSt.play = val.autoplay;
                itSt.playPrev = val.autoplay;
                itSt.waitingSome = 0;
                itSt.waitingVal = {};
            } else {
                itC.autoplay = 1;
                itSt.play = 1;
                itSt.playPrev = 1;
                itSt.waitingSome = 0;
                itSt.waitingVal = {};
            }
            //term
            if (val && itC.duration < val.term) itC.term = val.term * 1;
            else if (val && itC.duration >= val.term) itC.term = itC.duration + 1;
            else itC.term = 4000;
            //loop
            if (val && 0 <= val.loop && val.loop <= 2) itC.loop = val.loop * 1;
            else itC.loop = 1;
            //pnBtn
            if (val && val.pnBtn === 0) itC.pnBtn = 0;
            else itC.pnBtn = 1;
            //carBtn
            if (val && 0 <= val.carBtn && val.carBtn <= 2) itC.carBtn = val.carBtn * 1;
            else itC.carBtn = 1;
            //conBtn
            if (val && val.conBtn === 0) itC.conBtn = 0;
            else itC.conBtn = 1;
            //background
            if (val && val.background === 1) itC.background = 1;
            else itC.background = 0;
            //resizing
            if (val && val.resizing === 0) itC.resizing = 0;
            else itC.resizing = 1;
        }
        
        //record user event
        var recordEvent = function(i, val) {
            var it = slider[i];
            
            if (val.event) {
                it.event = val.event;
            }
        }
        
        //create slider app frame
        var createFrame = function(i, id) {
            var x1, i1, v1, v2, itSt = slider[i].state, itEl = slider[i].element, itC = slider[i].code;
            
            //get user slider frame
            v2 = document.getElementById(id);
            v2.removeAttribute('id');
            v2.setAttribute('class', id);
            x1 = v2.getElementsByTagName('LI');
            
            //record state
            itSt.l = x1.length;
            itSt.maxPage = x1.length - 1;
            itSt.curPage = 0;
            
            //record element content
            itEl.content = [];
            for (i1 = 0; i1 < itSt.l; i1++) {
                 itEl.content[i1] = x1[i1];
                if (i1 === 0) {
                    x1[i1].setAttribute('class', 'showing');
                    x1[i1].style.top = '0%';
                    x1[i1].style.left = '0%';
                    x1[i1].style.opacity = '1';
                }
                else {
                    if (itC.animation === 0 || itC.animation === 3) {
                        x1[i1].style.top = '0%';
                        x1[i1].style.left = '0%';
                        x1[i1].style.opacity = '0';
                        x1[i1].style.zIndex = '-1';
                    }
                    else if (itC.animation === 1) {
                        x1[i1].style.top = '0%';
                        x1[i1].style.left = '-100%';
                        x1[i1].style.opacity = '1';
                    }
                    else if (itC.animation === 2) {
                        x1[i1].style.top = '-100%';
                        x1[i1].style.left = '0%';
                        x1[i1].style.opacity = '1';
                    }
                }
            }
            x1 = v2;
            
            //about slider frame
            v1 = document.createElement('div');
            itEl.slider = v1; //record element slider
            v1.setAttribute('id', id);
            v1.setAttribute('class', 'nSlider');
            x1.parentNode.insertBefore(v1, x1);
            
            //about sWrap
            v1 = document.createElement('div');
            itEl.sWrap = v1; //record element wrap
            v1.setAttribute('class', 'sWrap');
            
            //about controller
            if (itC.conBtn === 1) {
                v2 = document.createElement('button');
                itEl.conBtn = v2; //record element conBtn
                if (itSt.play === 0) {
                    v2.setAttribute('class', 'conBtn playOff');
                    v2.setAttribute('aria-pressed', false);
                }
                else {
                    v2.setAttribute('class', 'conBtn playOn');
                    v2.setAttribute('aria-pressed', true);
                }
                v2.setAttribute('aria-live', 'polite');
                v2.setAttribute('title', 'slider play button');
                v1.appendChild(v2);
            }
            
            //append content LI
            v1.appendChild(x1);
            
            //about prevnext button
            if (itC.pnBtn === 1) {
                v2 = document.createElement('button');
                itEl.prevBtn = v2; //record element prevBtn
                v2.setAttribute('class', 'prevBtn');
                v2.setAttribute('aria-hidden', 'true');
                v2.setAttribute('tabindex', '-1');
                //if not loop, add class notBtn
                if (itC.loop === 0) {
                    v2.className += ' notBtn';
                }
                v1.appendChild(v2);
                v2 = document.createElement('button');
                itEl.nextBtn = v2; //record element nextBtn
                v2.setAttribute('class', 'nextBtn');
                v2.setAttribute('aria-hidden', 'true');
                v2.setAttribute('tabindex', '-1');
                //if not loop, add class notBtn
                if (itC.loop === 0 && itSt.l === 1) {
                    v2.className += ' notBtn';
                }
                v1.appendChild(v2);
            }
            
            //about carousel
            if (itC.carBtn === 1 || itC.carBtn === 2) {
                v2 = document.createElement('ul');
                v2.setAttribute('class', 'carousel');
                v2.setAttribute('aria-hidden', 'true');
                
                //record element carousel
                itEl.carousel = [];
                for (i1 = 0; i1 < itSt.l; i1++) {
                    x1 = document.createElement('li');
                    itEl.carousel[i1] = x1;
                    if (i1 === 0) {
                        x1.setAttribute('class', 'showing');
                    }
                    v2.appendChild(x1);
                }
                v1.appendChild(v2);
            }
            
            //sWrap append to slider frame
            v2 = v1;
            itEl.slider.appendChild(v2);
            
            //about background
            if (itC.background === 1) {
                v2 = document.createElement('ul');
                v2.setAttribute('class', 'sBg');
                
                //record element background
                itEl.background = [];
                for (i1 = 0; i1 < itSt.l; i1++) {
                    x1 = document.createElement('li');
                    itEl.background[i1] = x1;
                    if (i1 === 0) {
                        x1.setAttribute('class', 'showing');
                        x1.style.top = '0%';
                        x1.style.left = '0%';
                        x1.style.opacity = '1';
                    }
                    else {
                        if (itC.bgAnimation === 0 || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                            x1.style.top = '0%';
                            x1.style.left = '0%';
                            x1.style.opacity = '0';
                        }
                        else if (itC.animation === 1) {
                            x1.style.top = '0%';
                            x1.style.left = '-100%';
                            x1.style.opacity = '1';
                        }
                        else if (itC.animation === 2) {
                            x1.style.top = '-100%';
                            x1.style.left = '0%';
                            x1.style.opacity = '1';
                        }
                    }
                    v2.appendChild(x1);
                }
                itEl.slider.appendChild(v2);
            }
        }
        
        //set event
        var setEvent = function(i) {
            var c, x, y, i1, i2, l1, itC = slider[i].code, itSi = slider[i].size, itSt = slider[i].state, itEl = slider[i].element;
            //set size
            if (itSi.width && itC.resizing === 0) {
                itEl.sWrap.style.width = itSi.width + 'px';
                itEl.sWrap.style.height = itSi.height + 'px';
            }
            else if (itSi.width && itC.resizing === 1) {
                itEl.sWrap.style.maxWidth = itSi.width + 'px';
                x = itEl.sWrap.clientWidth * itSi.ratio;
                itEl.sWrap.style.height = x + 'px';
            }
            else if (itSi.ratio) {
                itEl.sWrap.style.width = '100%';
                x = itEl.sWrap.clientWidth * itSi.ratio;
                itEl.sWrap.style.height = x + 'px';
            }
            
            //check support addEventListener
            if (typeof document.addEventListener === 'function') {
                //about sWrap
                itEl.sWrap.addEventListener('mouseenter', function() {changePlaypause(i, 1);});
                itEl.sWrap.addEventListener('mouseleave', function() {changePlaypause(i, 0);});
                itEl.sWrap.addEventListener('touchstart', function(event) {touch.s(i, event);});
                itEl.sWrap.addEventListener('touchmove', function(event) {touch.m(i, event);});
                itEl.sWrap.addEventListener('touchend', function() {touch.e(i);});
                itEl.sWrap.addEventListener('touchcancel', function() {touch.e(i);});
                
                //set pnBtn
                if (itC.pnBtn === 1) {
                    //prevBtn
                    itEl.prevBtn.addEventListener('click', function() {goToPrev(i);});

                    //nextBtn
                    itEl.nextBtn.addEventListener('click', function() {goToNext(i);});
                }
                
                //set carousel
                if (0 < itC.carBtn) {
                    for (i1 = 0; i1 < itSt.l; i1++) {
                        if (itC.carBtn === 1) {
                            (function() {
                                var x = i1;
                                itEl.carousel[i1].addEventListener('click', function() {goToSel(i, x);});
                            }());   
                        }
                        else if (itC.carBtn === 2) {
                            (function() {
                                var x = i1;
                                itEl.carousel[i1].addEventListener('mouseover', function() {goToSel(i, x);});
                            }());
                        }
                    }
                }
                
                //set controller
                if (itC.conBtn === 1) {
                    itEl.conBtn.addEventListener('click', function() {conBtn(i);});
                }
                
                //set element in content that can focus
                for (i1 = 0; i1 < itSt.l; i1++) {
                    c = 0;//0 if none of the element in content hands can be focused
                    
                    (function() {
                        var i3 = i1;
                        itEl.content[i1].addEventListener('blur', function() {goToFoc(i, i3, 0);}, true);
                        itEl.content[i1].addEventListener('focus', function() {goToFoc(i, i3, 1);}, true);
                    }());
                    //if none of the element in content hands can be focused
                    x = ['a', 'area', 'button', 'input', 'textarea', 'select', 'datalist', 'keygen'];
                    for (y in x) if (c === 0 && itEl.content[i1].getElementsByTagName(x[y]).length !== 0) c = 1;
                    if (c === 0) itEl.content[i1].setAttribute('tabindex', '0');
                }
            }
            
            //if not support addEventListener
            else if (typeof document.attachEvent === 'object') {
                //about sWrap
                itEl.sWrap.attachEvent('onmouseenter', function() {changePlaypause(i, 1);});
                itEl.sWrap.attachEvent('onmouseleave', function() {changePlaypause(i, 0);});
                
                //set pnBtn
                if (itC.pnBtn === 1) {
                    //prevBtn
                    itEl.prevBtn.attachEvent('onclick', function() {goToPrev(i);});

                    //nextBtn
                    itEl.nextBtn.attachEvent('onclick', function() {goToNext(i);});
                }
                
                //set carousel
                if (0 < itC.carBtn) {
                    for (i1 = 0; i1 < itSt.l; i1++) {
                        if (itC.carBtn === 1) {
                            (function() {
                                var x = i1;
                                itEl.carousel[i1].attachEvent('onclick', function() {goToSel(i, x);});
                            }());   
                        }
                        else if (itC.carBtn === 2) {
                            (function() {
                                var x = i1;
                                itEl.carousel[i1].attachEvent('onmouseover', function() {goToSel(i, x);});
                            }());
                        }
                    }
                }
                
                //set controller
                if (itC.conBtn === 1) {
                    itEl.conBtn.attachEvent('onclick', function() {conBtn(i);});
                }
                
                //set element in content that can focus
                for (i1 = 0; i1 < itSt.l; i1++) {
                    c = 0;//0 if none of the element in content hands can be focused
                    
                    (function() {
                        var i3 = i1;
                        itEl.content[i1].attachEvent('onfocusout', function() {goToFoc(i, i3, 0);});
                        itEl.content[i1].attachEvent('onfocusin', function() {goToFoc(i, i3, 1);});
                    }());
                    //if none of the element in content hands can be focused
                    x = ['a', 'area', 'button', 'input', 'textarea', 'select', 'datalist', 'keygen'];
                    for (y in x) if (c === 0 && itEl.content[i1].getElementsByTagName(x[y]).length !== 0) c = 1;
                    if (c === 0) itEl.content[i1].setAttribute('tabindex', '0');
                }
            }
        }
        
        //go to previous content when press down prevBtn
        var goToPrev = function(i) {
            var itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            if (itSt.animation === 0) {
                
                //when current page is first page
                if (itSt.curPage === 0) {
                    
                    //when loop is infinity
                    if (itC.loop === 1) {
                        
                        //set background stay position when bgAni is reverse
                        if (itC.bgAnimation === 2) {
                            if (itC.animation === 1) {
                                itEl.background[itSt.maxPage].style.left = '100%';
                            }
                            else if (itC.animation === 2) {
                                itEl.background[itSt.maxPage].style.top = '100%';
                            }
                        }
                        
                        
                        //change animation state
                        itSt.animation = 1;
                        
                        //run animation
                        //50ms is to prevent issues for Firefox and IE *Same comment omitted
                        setTimeout(function() {prevConAni(i, itSt.curPage, itSt.maxPage);}, 50);
                        runEvent(i, itSt.curPage, itSt.maxPage);
                    }
                    
                    //when loop is return
                    else if (itC.loop === 2) {
                        
                        //set content stay position
                        if (itC.animation === 1) {
                            itEl.content[itSt.maxPage].style.left = '100%';
                        }
                        else if (itC.animation === 2) {
                            itEl.content[itSt.maxPage].style.top = '100%';
                        }
                        
                        //set background stay position
                        if (itC.background === 1 && itC.bgAnimation === 1) {
                            if (itC.animation === 1) {
                                itEl.background[itSt.maxPage].style.left = '100%';
                            }
                            else if (itC.animation === 2) {
                                itEl.background[itSt.maxPage].style.top = '100%';
                            }
                        }
                        
                        //change animation state
                        itSt.animation = 1;
                        
                        //run animation
                        setTimeout(function() {nextConAni(i, itSt.curPage, itSt.maxPage);}, 50);
                        runEvent(i, itSt.curPage, itSt.maxPage);
                    }
                }
                
                //when current page is not first page
                else {
                    
                    //set background stay position when bgAni is reverse
                    if (itC.background === 1 && itC.bgAnimation === 2) {
                        if (itC.animation === 1) {
                            itEl.background[itSt.curPage - 1].style.left = '100%';
                        }
                        else if (itC.animation === 2) {
                            itEl.background[itSt.curPage - 1].style.top = '100%';
                        }
                    }
                    
                    //change animation state
                    itSt.animation = 1;
                    
                    //run animation
                    setTimeout(function() {prevConAni(i, itSt.curPage, itSt.curPage - 1);}, 50);
                    runEvent(i, itSt.curPage, itSt.curPage - 1);
                }
                
                //check if not loop, remove nextBtn classname notBtn
                if (itC.loop === 0 && itSt.curPage === itSt.maxPage) {
                    itEl.nextBtn.className = itEl.nextBtn.className.replace(/[\s]*notBtn/, '');
                }
                
                //check if not loop, add prevBtn classname notBtn
                else if (itC.loop === 0 && itSt.curPage - 1 === 0) {
                    itEl.prevBtn.className += ' notBtn';
                }
            }
        }
        
        //go to next content  when press down nextBtn
        var goToNext = function(i) {
            var itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            if (itSt.animation === 0) {
                
                //when current page is last page
                if (itSt.curPage === itSt.maxPage) {
                    
                    //when loop is infinity
                    if (itC.loop === 1) {
                        
                        //set content stay position
                        if (itC.animation === 1) {
                            itEl.content[0].style.left = '100%';
                        }
                        else if (itC.animation === 2) {
                            itEl.content[0].style.top = '100%';
                        }
                        
                        //set background stay position
                        if (itC.background === 1 && itC.bgAnimation === 1) {
                            if (itC.animation === 1) {
                                itEl.background[0].style.left = '100%';
                            }
                            else if (itC.animation === 2) {
                                itEl.background[0].style.top = '100%';
                            }
                        }
                        
                        //change animation state
                        itSt.animation = 1;
                        
                        //run animation
                        setTimeout(function() {nextConAni(i, itSt.curPage, 0);}, 50);
                        runEvent(i, itSt.curPage, 0);
                    }
                    
                    //when loop is return
                    else if (itC.loop === 2) {
                        
                        //set background stay position when bgAni is reverse
                        if (itC.background === 1 && itC.bgAnimation === 2) {
                            if (itC.animation === 1) {
                                itEl.background[0].style.left = '100%';
                            }
                            else if (itC.animation === 2) {
                                itEl.background[0].style.top = '100%';
                            }
                        }
                        
                        //change animation state
                        itSt.animation = 1;
                        
                        //run animation
                        setTimeout(function() {prevConAni(i, itSt.curPage, 0);}, 50);
                        runEvent(i, itSt.curPage, 0);
                    }
                    
                }
                
                //when current page is not last page
                else {
                    
                    //set content stay position
                    if (itC.animation === 1) {
                        itEl.content[itSt.curPage + 1].style.left = '100%';
                    }
                    else if (itC.animation === 2) {
                        itEl.content[itSt.curPage + 1].style.top = '100%';
                    }
                    
                    //set background stay position
                    if (itC.background === 1 && itC.bgAnimation === 1) {
                        if (itC.animation === 1) {
                            itEl.background[itSt.curPage + 1].style.left = '100%';
                        }
                        else if (itC.animation === 2) {
                            itEl.background[itSt.curPage + 1].style.top = '100%';
                        }
                    }
                    
                    //change animation state
                    itSt.animation = 1;
                    
                    //run animation
                    setTimeout(function() {nextConAni(i, itSt.curPage, itSt.curPage + 1);}, 50);
                    runEvent(i, itSt.curPage, itSt.curPage + 1);
                }
                
                //check if not loop, add nextBtn classname notBtn
                if (itC.loop === 0 && itSt.curPage + 1 === itSt.maxPage) {
                    itEl.nextBtn.className += ' notBtn';
                }
                
                //check if not loop, remove prevBtn classname notBtn
                else if (itC.loop === 0 && itSt.curPage === 0) {
                    itEl.prevBtn.className = itEl.prevBtn.className.replace(/[\s]*notBtn/, '');
                }
            }
        }
        
        //go to select content  when press down carousel
        var goToSel = function(i, s) {
            var itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            if (itSt.animation === 0) {
                
                //select page is greater than current page
                if (itSt.curPage < s) {
                    
                    //set content stay position
                    if (itC.animation === 1) {
                        itEl.content[s].style.left = '100%';
                    }
                    else if (itC.animation === 2) {
                        itEl.content[s].style.top = '100%';
                    }
                    
                    //set background stay position
                    if (itC.background === 1 && itC.bgAnimation === 1) {
                        if (itC.animation === 1) {
                            itEl.background[s].style.left = '100%';
                        }
                        else if (itC.animation === 2) {
                            itEl.background[s].style.top = '100%';
                        }
                    }
                    
                    //change animation state
                    itSt.animation = 1;
                    
                    //run animation
                    setTimeout(function() {nextConAni(i, itSt.curPage, s);}, 50);
                    runEvent(i, itSt.curPage, s);
                }
                
                //current page is greater than current page select page
                else if (itSt.curPage > s) {
                    
                    //set background stay position when bgAni is reverse
                    if (itC.background === 1 && itC.bgAnimation === 2) {
                        if (itC.animation === 1) {
                            itEl.background[s].style.left = '100%';
                        }
                        else if (itC.animation === 2) {
                            itEl.background[s].style.top = '100%';
                        }
                    }
                    
                    //change animation state
                    itSt.animation = 1;
                    
                    //run animation
                    setTimeout(function() {prevConAni(i, itSt.curPage, s);}, 50);
                    runEvent(i, itSt.curPage, s);
                }
            }
        }
        
        //go to focus content
        var goToFoc = function(i, s, m) {
            var itSt = slider[i].state;
            
            if (m === 1) {
                //if select page is not current page
                if (s !== itSt.curPage && itSt.animation === 0) {
                    goToSel(i, s);
                }
                else if (s !== itSt.curPage && itSt.animation === 1) {
                    itSt.waitingSome = 1;
                    itSt.waitingVal.i = i;
                    itSt.waitingVal.s = s;
                }
                
                //pause auto play
                changePlaypause(i, m);
            }
            
            
            else if (m === 0) {
                //restart auto play
                changePlaypause(i, m);
            }
        }
        
        //slider controller
        var conBtn = function(i) {
            var itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            
            //play state change to playOn
            if (itSt.play === 0 || (itSt.play === 2 && itSt.playPrev === 0)) {
                itSt.play = 1;
                itSt.playPrev = 1;
                if (itC.conBtn === 1) {
                    itEl.conBtn.setAttribute('class', 'conBtn playOn');
                    itEl.conBtn.setAttribute('aria-pressed', true);
                }
                
                //restart auto play
                slider[i].state.setTimeoutValue = setTimeout(function() {autoPlay(i);}, slider[i].code.term);
            }
            
            //play state change to playOff
            else if (itSt.play === 1 || (itSt.play === 2 && itSt.playPrev === 1)) {
                itSt.play = 0;
                itSt.playPrev = 0;
                if (itC.conBtn === 1) {
                    itEl.conBtn.setAttribute('class', 'conBtn playOff');
                    itEl.conBtn.setAttribute('aria-pressed', false);
                }
                
                //pause auto play
                clearTimeout(itSt.setTimeoutValue);
            }
        }
        
        //change state play pause
        var changePlaypause = function(i, m) {
            var itSt = slider[i].state;
            
            //state play getback
            if (m === 0) {
                itSt.play = itSt.playPrev;
                
                //restart auto play when play state is not playOff
                if (itSt.play !== 0) {
                    clearTimeout(itSt.setTimeoutValue);
                    slider[i].state.setTimeoutValue = setTimeout(function() {autoPlay(i);}, slider[i].code.term);
                }
            }
            
            //state play pause
            else if (m === 1) {
                if (itSt.play !== 2) {
                    itSt.playPrev = itSt.play;
                }
                itSt.play = 2;
                
                //pause auto play
                clearTimeout(itSt.setTimeoutValue);
            }
        }
        
        //go to previous content animation
        var prevConAni = function(i, c, s) {
            var x, setT, getT, curT, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            
            //update current page
            itSt.curPage = s;
            
            //state play pause
            changePlaypause(i, 1);
            
            //animation for browsers that can use transitions
            var canTransitionAni = function() {
                if (itC.animation === 0) {
                    itEl.content[c].style.opacity = '0';
                    itEl.content[c].style.zIndex = '-1';
                    itEl.content[s].style.opacity = '1';
                    itEl.content[s].style.zIndex = '';
                    setTimeout(animationEnd, 50, i, c, s);
                }
                else if (itC.animation === 1) {
                    itEl.content[c].style.left = '100%';
                    itEl.content[s].style.left = '0%';
                    setTimeout(animationEnd, itC.duration, i, c, s);
                }
                else if (itC.animation === 2) {
                    itEl.content[c].style.top = '100%';
                    itEl.content[s].style.top = '0%';
                    setTimeout(animationEnd, itC.duration, i, c, s);
                }
                else if (itC.animation === 3) {
                    itEl.content[c].style.opacity = '0';
                    itEl.content[c].style.zIndex = '-1';
                    itEl.content[s].style.opacity = '1';
                    itEl.content[s].style.zIndex = '';
                    setTimeout(animationEnd, itC.duration, i, c, s);
                }
            }
            
            itEl.content[c].removeAttribute('class');
            itEl.content[s].setAttribute('class', 'showing');
            
            //can use transitions
            if (typeof document.body.style.transition === 'string') {
                itEl.content[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.content[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //can use -webkit-transitions
            else if (typeof document.body.style.webkitTransition === 'string') {
                itEl.content[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.content[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //animation for older browsers containing IE9-
            else {
                if (itC.animation === 0) {
                    itEl.content[c].style.opacity = '0';
                    itEl.content[c].style.zIndex = '-1';
                    itEl.content[s].style.opacity = '1';
                    itEl.content[s].style.zIndex = '';
                    setTimeout(function() {animationEnd(i, c, s);}, 50);
                }
                else {
                    setT = new Date().getTime();
                    scriptAni();
                    function scriptAni() {
                        getT = new Date().getTime();
                        curT = getT - setT;
                        x = (Math.cos(curT / itC.duration * Math.PI) * -1 + 1) * .5;//Animation ease
                        if (itC.animation === 1) {
                            itEl.content[c].style.left = x * 100 + '%';
                            itEl.content[s].style.left = (x * 100) - 100 + '%';
                        }
                        else if (itC.animation === 2) {
                            itEl.content[c].style.top = x * 100 + '%';
                            itEl.content[s].style.top = (x * 100) - 100 + '%';
                        }
                        else if (itC.animation === 3) {
                            itEl.content[c].style.opacity = 1 - x;
                            itEl.content[s].style.opacity = x;
                        }
                        
                        if (curT / itC.duration < 1) {
                            setTimeout(scriptAni, Math.min(10, itC.duration - curT));
                        }
                        else {
                            if (itC.animation === 1) {
                                itEl.content[c].style.left = '100%';
                                itEl.content[s].style.left = '0%';
                            }
                            else if (itC.animation === 2) {
                                itEl.content[c].style.top = '100%';
                                itEl.content[s].style.top = '0%';
                            }
                            else if (itC.animation === 3) {
                                itEl.content[c].style.opacity = '0';
                                itEl.content[c].style.zIndex = '-1';
                                itEl.content[s].style.opacity = '1';
                                itEl.content[s].style.zIndex = '';
                            }
                            setTimeout(function() {animationEnd(i, c, s);}, 50);
                        }
                    }
                }
            }
            
            //when enable carousel
            if (itC.carBtn !== 0) {
                itEl.carousel[c].removeAttribute('class');
                itEl.carousel[s].setAttribute('class', 'showing');
            }
            
            //when enable background
            if (itC.background === 1) {
                itEl.background[c].removeAttribute('class');
                itEl.background[s].setAttribute('class', 'showing');
                
                //run background animation
                if (itC.bgAnimation === 2) {
                    nextBgAni(i, c, s);
                }
                else {
                    prevBgAni(i, c, s);
                }
            }
        }
        
        //go to next content animation
        var nextConAni = function(i, c, s) {
            var x, setT, getT, curT, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            
            //update current page
            itSt.curPage = s;
            
            //state play pause
            changePlaypause(i, 1);
            
            //animation for browsers that can use transitions
            var canTransitionAni = function() {
                if (itC.animation === 0) {
                    itEl.content[c].style.opacity = '0';
                    itEl.content[c].style.zIndex = '-1';
                    itEl.content[s].style.opacity = '1';
                    itEl.content[s].style.zIndex = '';
                    setTimeout(animationEnd, 50, i, c, s);
                }
                else if (itC.animation === 1) {
                    itEl.content[c].style.left = '-100%';
                    itEl.content[s].style.left = '0%';
                    setTimeout(animationEnd, itC.duration, i, c, s);
                }
                else if (itC.animation === 2) {
                    itEl.content[c].style.top = '-100%';
                    itEl.content[s].style.top = '0%';
                    setTimeout(animationEnd, itC.duration, i, c, s);
                }
                else if (itC.animation === 3) {
                    itEl.content[c].style.opacity = '0';
                    itEl.content[c].style.zIndex = '-1';
                    itEl.content[s].style.opacity = '1';
                    itEl.content[s].style.zIndex = '';
                    setTimeout(animationEnd, itC.duration, i, c, s);
                }
            }
            
            
            itEl.content[c].removeAttribute('class');
            itEl.content[s].setAttribute('class', 'showing');
            
            //can use transitions
            if (typeof document.body.style.transition === 'string') {
                itEl.content[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.content[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //can use -webkit-transitions
            else if (typeof document.body.style.webkitTransition === 'string') {
                itEl.content[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.content[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //animation for older browsers containing IE9-
            else {
                if (itC.animation === 0) {
                    itEl.content[c].style.opacity = '0';
                    itEl.content[c].style.zIndex = '-1';
                    itEl.content[s].style.opacity = '1';
                    itEl.content[s].style.zIndex = '';
                    setTimeout(function() {animationEnd(i, c, s);}, 50);
                }
                else {
                    setT = new Date().getTime();
                    scriptAni();
                    function scriptAni() {
                        getT = new Date().getTime();
                        curT = getT - setT;
                        x = (Math.cos(curT / itC.duration * Math.PI) * -1 + 1) * .5;//Animation ease
                        if (itC.animation === 1) {
                            itEl.content[c].style.left = 0 - (x * 100) + '%';
                            itEl.content[s].style.left = 100 - (x * 100) + '%';
                        }
                        else if (itC.animation === 2) {
                            itEl.content[c].style.top = 0 - (x * 100) + '%';
                            itEl.content[s].style.top = 100 - (x * 100) + '%';
                        }
                        else if (itC.animation === 3) {
                            itEl.content[c].style.opacity = 1 - x;
                            itEl.content[s].style.opacity = x;
                        }
                        
                        if (curT / itC.duration < 1) {
                            setTimeout(scriptAni, Math.min(10, itC.duration - curT));
                        }
                        else {
                            if (itC.animation === 1) {
                                itEl.content[c].style.left = '-100%';
                                itEl.content[s].style.left = '0%';
                            }
                            else if (itC.animation === 2) {
                                itEl.content[c].style.top = '-100%';
                                itEl.content[s].style.top = '0%';
                            }
                            else if (itC.animation === 3) {
                                itEl.content[c].style.opacity = '0';
                                itEl.content[c].style.zIndex = '-1';
                                itEl.content[s].style.opacity = '1';
                                itEl.content[s].style.zIndex = '';
                            }
                            setTimeout(function() {animationEnd(i, c, s);}, 50);
                        }
                    }
                }
            }
            
            //when enable carousel
            if (itC.carBtn !== 0) {
                itEl.carousel[c].removeAttribute('class');
                itEl.carousel[s].setAttribute('class', 'showing');
            }
            
            //when enable background
            if (itC.background === 1) {
                itEl.background[c].removeAttribute('class');
                itEl.background[s].setAttribute('class', 'showing');
                
                //run background animation
                if (itC.bgAnimation === 2) {
                    prevBgAni(i, c, s);
                }
                else {
                    nextBgAni(i, c, s);
                }
            }
        }
        
        //go to prev background animation
        var prevBgAni = function(i, c, s) {
            var x, setT, getT, curT, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            
            //animation for browsers that can use transitions
            var canTransitionAni = function() {
                if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                    itEl.background[c].style.opacity = '0';
                    itEl.background[s].style.opacity = '1';
                }
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                    itEl.background[c].style.left = '100%';
                    itEl.background[s].style.left = '0%';
                }
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                    itEl.background[c].style.top = '100%';
                    itEl.background[s].style.top = '0%';
                }
            }
            
            //can use transitions
            if (typeof document.body.style.transition === 'string') {
                itEl.background[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.background[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //can use -webkit-transitions
            else if (typeof document.body.style.webkitTransition === 'string') {
                itEl.background[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.background[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //animation for older browsers containing IE9-
            else {
                if (itC.animation === 0) {
                    itEl.background[c].style.opacity = '0';
                    itEl.background[s].style.opacity = '1';
                }
                else {
                    setT = new Date().getTime();
                    scriptAni();
                    function scriptAni() {
                        getT = new Date().getTime();
                        curT = getT - setT;
                        x = (Math.cos(curT / itC.duration * Math.PI) * -1 + 1) * .5;//Animation ease
                        if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                            itEl.background[c].style.opacity = 1 - x;
                            itEl.background[s].style.opacity = x;
                        }
                        else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                            itEl.background[c].style.left = x * 100 + '%';
                            itEl.background[s].style.left = (x * 100) - 100 + '%';
                        }
                        else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                            itEl.background[c].style.top = x * 100 + '%';
                            itEl.background[s].style.top = (x * 100) - 100 + '%';
                        }

                        if (curT / itC.duration < 1) {
                            setTimeout(scriptAni, Math.min(10, itC.duration - curT));
                        }
                        else {
                            if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                                itEl.background[c].style.opacity = '0';
                                itEl.background[s].style.opacity = '1';
                            }
                            else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                                itEl.background[c].style.left = '100%';
                                itEl.background[s].style.left = '0%';
                            }
                            else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                                itEl.background[c].style.top = '100%';
                                itEl.background[s].style.top = '0%';
                            }
                        }
                    }
                }
            }
        }
        
        //go to next background animation
        var nextBgAni = function(i, c, s) {
            var x, setT, getT, curT, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            
            //animation for browsers that can use transitions
            var canTransitionAni = function() {
                if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                    itEl.background[c].style.opacity = '0';
                    itEl.background[s].style.opacity = '1';
                }
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                    itEl.background[c].style.left = '-100%';
                    itEl.background[s].style.left = '0%';
                }
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                    itEl.background[c].style.top = '-100%';
                    itEl.background[s].style.top = '0%';
                }
            }
            
            //can use transitions
            if (typeof document.body.style.transition === 'string') {
                itEl.background[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.background[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //can use -webkit-transitions
            else if (typeof document.body.style.webkitTransition === 'string') {
                itEl.background[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                itEl.background[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                canTransitionAni();
            }
            
            //animation for older browsers containing IE9-
            else {
                if (itC.animation === 0) {
                    itEl.background[c].style.opacity = '0';
                    itEl.background[s].style.opacity = '1';
                }
                else {
                    setT = new Date().getTime();
                    scriptAni();
                    function scriptAni() {
                        getT = new Date().getTime();
                        curT = getT - setT;
                        x = (Math.cos(curT / itC.duration * Math.PI) * -1 + 1) * .5;//Animation ease
                        if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                            itEl.background[c].style.opacity = 1 - x;
                            itEl.background[s].style.opacity = x;
                        }
                        else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                            itEl.background[c].style.left = 0 - (x * 100) + '%';
                            itEl.background[s].style.left = 100 - (x * 100) + '%';
                        }
                        else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                            itEl.background[c].style.top = 0 - (x * 100) + '%';
                            itEl.background[s].style.top = 100 - (x * 100) + '%';
                        }

                        if (curT / itC.duration < 1) {
                            setTimeout(scriptAni, Math.min(10, itC.duration - curT));
                        }
                        else {
                            if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                                itEl.background[c].style.opacity = '0';
                                itEl.background[s].style.opacity = '1';
                            }
                            else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                                itEl.background[c].style.left = '-100%';
                                itEl.background[s].style.left = '0%';
                            }
                            else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                                itEl.background[c].style.top = '-100%';
                                itEl.background[s].style.top = '0%';
                            }
                        }
                    }
                }
            }
        }
        
        //set attribute when animation end
        var animationEnd = function(i, c, s) {
            var itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
            
            //content stay position
            if (itC.animation === 1) {
                itEl.content[c].style.left = '-100%';
            }
            else if (itC.animation === 2) {
                itEl.content[c].style.top = '-100%';
            }
            
            //background stay position
            if (itC.background === 1) {
                if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                    itEl.background[c].style.left = '-100%';
                }
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                    itEl.background[c].style.top = '-100%';
                }
            }
            
            //remove attribute transition
            if (typeof document.body.style.transition === 'string') {
                itEl.content[c].style.transition = '';
                itEl.content[s].style.transition = '';
                if (itC.background === 1) {
                    itEl.background[c].style.transition = '';
                    itEl.background[s].style.transition = '';
                }
            }
            
            //remove attribute -webkit-transition
            else if (typeof document.body.style.webkitTransition === 'string') {
                itEl.content[c].style.webkitTransition = '';
                itEl.content[s].style.webkitTransition = '';
                if (itC.background === 1) {
                    itEl.background[c].style.webkitTransition = '';
                    itEl.background[s].style.webkitTransition = '';
                }
            }
            
            //animation state reset
            itSt.animation = 0;
            
            //state play getback
            changePlaypause(i, 0);
            
            //if some focus waiting
            if (itSt.waitingSome === 1) {
                itSt.waitingSome = 0;
                goToSel(itSt.waitingVal.i, itSt.waitingVal.s);
            }
        }
        
        //autoplay
        var autoPlay = function(i) {
            var itC = slider[i].code, itSt = slider[i].state;
            
            //if not that not loop and current page is max page
            if (!(itC.loop === 0 && itSt.curPage === itSt.maxPage)) {
                goToNext(i);
                itSt.setTimeoutValue = setTimeout(function() {autoPlay(i);}, itC.term);
            }
            
            //if not loop, stop auto play
            if (itC.loop === 0 && itSt.curPage + 1 === itSt.maxPage) {
                conBtn(i);
            }
        }
        
        //ready for runResizing
        var readyResizing = function() {
            clearInterval(resizing.run);
            resizing.run = setInterval(runResizing, 100);
        }
        
        //Run resizing
        var runResizing = function() {
            var i, x, itC, itEl, itSi;
            
            for (i in slider) {
                itC = slider[i].code, itEl = slider[i].element, itSi = slider[i].size;

                //if  resize code is enabled
                if (itC.resizing === 1) {
                    x = itEl.sWrap.clientWidth * itSi.ratio;
                    itEl.sWrap.style.height = x + 'px';
                }
            }
        }
        
        //add event resize
        var addResize = function() {
            
            //if the event has never been added
            if (!resizing.added) {
                resizing.added = true;
                
                //check support addEventListener
                if (typeof document.addEventListener === 'function') {
                    window.addEventListener("resize", readyResizing);
                }

                //if not support addEventListener
                else if (typeof document.attachEvent === 'object') {
                    window.attachEvent("onresize", readyResizing);
                }
            }
        }
        
        //touch
        var touch = (function() {
            var touched = {
                coordinate: {},
                time: {},
                direction: {},
                state: {}
            }
            
            //event touch start
            var start = function(i, eve) {
                var tC = touched.coordinate, tT = touched.time, tD = touched.direction, tS = touched.state;
                
                //input initial touch value
                tC.startX = tC.prevX = tC.nowX = eve.touches[0].screenX;
                tC.startY = tC.prevY = tC.nowY = eve.touches[0].screenY;
                tT.start = new Date().getTime();
                tD.nowX = 0;
                tD.nowY = 0;
                tS.touchValid = 0;
                tS.speed = 0;
                tS.prevE = false;
                tS.nextE = false;
            }
            
            //event touch move
            var move = function(i, eve) {
                var tC = touched.coordinate, tT = touched.time, tD = touched.direction, tS = touched.state, itC = slider[i].code, itSt = slider[i].state;
                
                //check that this touch is valid for controlling the slider
                //-1: control the scrolling (can not control the slider)
                //0: not checked yet
                //1: control the slider (can not control scrolling)
                if (tS.touchValid === 0 && itSt.animation === 0) {
                    
                    //input moving touch value
                    tC.nowX = eve.touches[0].screenX;
                    tC.nowY = eve.touches[0].screenY;
                    tT.now = new Date().getTime();
                    tD.prevX = tD.nowX;
                    tD.prevY = tD.nowY;
                    tC.width = Math.abs(tC.prevX - tC.nowX);
                    tC.height = Math.abs(tC.prevY - tC.nowY);
                    
                    //animation code is not vertical
                    if (itC.animation !== 2) {
                        if (tC.height / tC.width < 1) {
                            tS.touchValid = 1;
                            changePlaypause(i, 1);
                            eve.preventDefault();
                        }
                        else {
                            tS.touchValid = -1;
                        }
                    }
                    
                    //animation code is vertical
                    else {
                        if (tC.height / tC.width < 1) {
                            tS.touchValid = -1;
                        }
                        else {
                            tS.touchValid = 1;
                            changePlaypause(i, 1);
                            eve.preventDefault();
                        }
                    }
                }
                
                //run touchmove when touchValid value is 1
                else if (tS.touchValid === 1 && itSt.animation === 0) {
                    eve.preventDefault();
                    
                    //input moving touch value
                    tC.nowX = eve.touches[0].screenX;
                    tC.nowY = eve.touches[0].screenY;
                    tT.now = new Date().getTime();
                    tD.prevX = tD.nowX;
                    tD.prevY = tD.nowY;
                    tC.width = Math.abs(tC.prevX - tC.nowX);
                    tC.height = Math.abs(tC.prevY - tC.nowY);
                    
                    //sense horizontal touch direction
                    if (0 < tC.nowX - tC.prevX) {
                        tD.nowX = 1;
                    }
                    else if (0 > tC.nowX - tC.prevX) {
                        tD.nowX = -1;
                    }

                    //sense vertical touch direction
                    if (0 < tC.nowY - tC.prevY) {
                        tD.nowY = -1;
                    }
                    else if (0 > tC.nowY - tC.prevY) {
                        tD.nowY = 1;
                    }

                    //resets the reference value when 0.1 second more or the touch direction is changed
                    if ((100 < tT.now - tT.start) || (tD.prevX != tD.nowX || tD.prevY != tD.nowY)) {
                        tC.prevX = tC.nowX;
                        tC.prevY = tC.nowY;
                        tT.start = tT.now;
                    }
                    
                    touchMoveCon(i);
                    if (itC.background === 1) {
                        touchMoveBg(i);
                    }
                }
            }
            
            //event touch end
            var end = function(i) {
                var tC = touched.coordinate, tT = touched.time, tD = touched.direction, tS = touched.state, itC = slider[i].code, itSt = slider[i].state;
                
                if (tS.touchValid === 1) {
                    itSt.animation = 1;

                    //horizontal movement distance for speed calculation
                    tC.width = Math.abs(tC.prevX - tC.nowX);
                    //vertical movement distance for speed calculation
                    tC.height = Math.abs(tC.prevY - tC.nowY);
                    //diagonal movement distance for speed calculation
                    tC.diagonal = Math.round(Math.sqrt((tC.width * tC.width) + (tC.height * tC.height)));
                    //touch time for speed calculation
                    tT.now = new Date().getTime();
                    tT.elapse = tT.now - tT.start;

                    //touch speed = px/0.01s in unit
                    tS.speed = Math.round(tC.diagonal * 10 / tT.elapse);
                    
                    //when previous motion is valid
                    if (0 < tD.prevnext) {
                        if (4 <= tS.speed && ((itC.animation !== 2 && tD.nowX === 1) || (itC.animation === 2 && tD.nowY === -1))) {
                            if (!(itC.loop === 0 && itSt.curPage === 0)) {
                                if (itSt.curPage === 0) {
                                    prevConAni(i, itSt.curPage, itSt.maxPage);
                                }
                                else {
                                    prevConAni(i, itSt.curPage, itSt.curPage - 1);
                                }
                            }
                            else {
                                restoreLocationPrevConAni(i, itSt.curPage);
                            }
                        }
                        else if (30 <= tC.length && ((itC.animation !== 2 && tD.nowX === 1) || (itC.animation === 2 && tD.nowY === -1))) {
                            if (itC.loop === 2 && itSt.curPage === 0) {
                                prevConAni(i, itSt.curPage, itSt.maxPage);
                            }
                            else if (60 <= tC.length && !(itC.loop === 0 && itSt.curPage === 0)) {
                                if (itSt.curPage === 0) {
                                    prevConAni(i, itSt.curPage, itSt.maxPage);
                                }
                                else {
                                    prevConAni(i, itSt.curPage, itSt.curPage - 1);
                                }
                            }
                            else {
                                if (itC.loop === 0 && itSt.curPage === 0) {
                                    restoreLocationPrevConAni(i, itSt.curPage);
                                }
                                else if (itC.loop !== 0 && itSt.curPage === 0) {
                                    restoreLocationPrevConAni(i, itSt.curPage, itSt.maxPage);
                                }
                                else {
                                    restoreLocationPrevConAni(i, itSt.curPage, itSt.curPage - 1);
                                }
                            }
                        }
                        else {
                            if ((itC.loop === 0 || itC.loop === 2) && itSt.curPage === 0) {
                                restoreLocationPrevConAni(i, itSt.curPage);
                            }
                            else if (itSt.curPage === 0) {
                                restoreLocationPrevConAni(i, itSt.curPage, itSt.maxPage);
                            } else {
                                restoreLocationPrevConAni(i, itSt.curPage, itSt.curPage - 1);
                            }
                        }
                    }
                    
                    //when next motion is valid
                    else if (0 > tD.prevnext) {
                        if (4 <= tS.speed && ((itC.animation !== 2 && tD.nowX === -1) || (itC.animation === 2 && tD.nowY === 1))) {
                            if (!(itC.loop === 0 && itSt.curPage === itSt.maxPage)) {
                                if (itSt.curPage === itSt.maxPage) {
                                    nextConAni(i, itSt.curPage, 0);
                                }
                                else {
                                    nextConAni(i, itSt.curPage, itSt.curPage + 1);
                                }
                            }
                            else {
                                restoreLocationNextConAni(i, itSt.curPage);
                            }
                        }
                        else if (30 <= tC.length && ((itC.animation !== 2 && tD.nowX === -1) || (itC.animation === 2 && tD.nowY === 1))) {
                            if (itC.loop === 2 && itSt.curPage === itSt.maxPage) {
                                nextConAni(i, itSt.curPage, 0);
                            }
                            else if (60 <= tC.length && !(itC.loop === 0 && itSt.curPage === itSt.maxPage)) {
                                if (itSt.curPage === 0 || !(itSt.curPage === itSt.maxPage)) {
                                    nextConAni(i, itSt.curPage, itSt.curPage + 1);
                                }
                                else if (itSt.curPage === itSt.maxPage) {
                                    nextConAni(i, itSt.curPage, 0);
                                }
                            }
                            else {
                                if (itC.loop === 0 && itSt.curPage === itSt.maxPage) {
                                    restoreLocationNextConAni(i, itSt.curPage);
                                }
                                else if (itC.loop !== 0 && itSt.curPage === itSt.maxPage) {
                                    restoreLocationNextConAni(i, itSt.curPage, 0);
                                }
                                else {
                                    restoreLocationNextConAni(i, itSt.curPage, itSt.curPage + 1);
                                }
                            }
                        }
                        else {
                            if ((itC.loop === 0 || itC.loop === 2) && itSt.curPage === itSt.maxPage) {
                                restoreLocationNextConAni(i, itSt.curPage);
                            }
                            else if (itSt.curPage === itSt.maxPage) {
                                restoreLocationNextConAni(i, itSt.curPage, 0);
                            }
                            else {
                                restoreLocationNextConAni(i, itSt.curPage, itSt.curPage + 1);
                            }
                        }
                    }
                }
            }
            
            //move content to touch
            var touchMoveCon = function(i) {
                var tS = touched.state, tC = touched.coordinate, tD = touched.direction, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
                
                itSt.curWidth = itEl.sWrap.clientWidth, itSt.curHeight = itEl.sWrap.clientHeight;
                
                if (itC.animation === 2) {
                    tD.prevnext = tC.nowY - tC.startY;
                    tC.length = Math.round(Math.abs((tC.startY - tC.nowY) / itSt.curHeight * 100));
                }
                else {
                    tD.prevnext = tC.nowX - tC.startX;
                    tC.length = Math.round(Math.abs((tC.startX - tC.nowX) / itSt.curWidth * 100));
                }
                
                //run user event
                if (0 < tD.prevnext && tS.prevE === false) {//prev
                    tS.prevE = true;
                    
                    if (itSt.curPage === 0) {
                        runEvent(i, itSt.curPage, itSt.maxPage);
                    }
                    else {
                        runEvent(i, itSt.curPage, itSt.curPage - 1);
                    }
                }
                else if (0 > tD.prevnext && tS.nextE === false) {//next
                    tS.nextE = true;
                    
                    if (itSt.curPage === itSt.maxPage) {
                        runEvent(i, itSt.curPage, 0);
                    }
                    else {
                        runEvent(i, itSt.curPage, itSt.curPage + 1);
                    }
                }
                
                if (itC.animation === 1) {
                    
                    //try view previous content
                    if (0 < tD.prevnext) {
                        
                        if (itSt.curPage === 0) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.left = tC.length + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.content[itSt.curPage].style.left = tC.length + '%';
                                itEl.content[itSt.maxPage].style.left = (tC.length - 100) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.left = tC.length + '%';
                                itEl.content[itSt.maxPage].style.left = (tC.length + 100) + '%';
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.content[itSt.curPage].style.left = tC.length + '%';
                                itEl.content[itSt.curPage - 1].style.left = (tC.length - 100) + '%';
                            }
                        }
                    }
                    //try view next content
                    else {
                        
                        if (itSt.curPage === itSt.maxPage) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.left = (0 - tC.length) + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.content[itSt.curPage].style.left = (0 - tC.length) + '%';
                                itEl.content[0].style.left = (100 - tC.length) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.left = (0 - tC.length) + '%';
                                itEl.content[0].style.left = (-100 - tC.length) + '%';
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.content[itSt.curPage].style.left = (0 - tC.length) + '%';
                                itEl.content[itSt.curPage + 1].style.left = (100 - tC.length) + '%';
                            }
                        }
                    }
                }
                else if (itC.animation === 2) {
                    
                    //try view previous content
                    if (0 < tD.prevnext) {
                        
                        if (itSt.curPage === 0) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.top = tC.length + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.content[itSt.curPage].style.top = tC.length + '%';
                                itEl.content[itSt.maxPage].style.top = (tC.length - 100) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.top = tC.length + '%';
                                itEl.content[itSt.maxPage].style.top = (tC.length + 100) + '%';
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.content[itSt.curPage].style.top = tC.length + '%';
                                itEl.content[itSt.curPage - 1].style.top = (tC.length - 100) + '%';
                            }
                        }
                    }
                    //try view next content
                    else {
                        
                        if (itSt.curPage === itSt.maxPage) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.top = (0 - tC.length) + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.content[itSt.curPage].style.top = (0 - tC.length) + '%';
                                itEl.content[0].style.top = (100 - tC.length) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.top = (0 - tC.length) + '%';
                                itEl.content[0].style.top = (-100 - tC.length) + '%';
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.content[itSt.curPage].style.top = (0 - tC.length) + '%';
                                itEl.content[itSt.curPage + 1].style.top = (100 - tC.length) + '%';
                            }
                        }
                    }
                }
                else if (itC.animation === 3) {
                    
                    //try view previous content
                    if (0 < tD.prevnext) {
                        
                        if (itSt.curPage === 0) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.content[itSt.maxPage].style.opacity = tC.length * 0.01;
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.content[itSt.maxPage].style.opacity = tC.length * 0.01;
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.content[itSt.curPage - 1].style.opacity = tC.length * 0.01;
                            }
                        }
                    }
                    //try view next content
                    else {
                        
                        if (itSt.curPage === itSt.maxPage) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.content[0].style.opacity = tC.length * 0.01;
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.content[0].style.opacity = tC.length * 0.01;
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.content[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.content[itSt.curPage + 1].style.opacity = tC.length * 0.01;
                            }
                        }
                    }
                }
            }
            
            //move background to touch
            var touchMoveBg = function(i) {
                var x, tC = touched.coordinate, tD = touched.direction, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
                
                itSt.curWidth = itEl.sWrap.clientWidth, itSt.curHeight = itEl.sWrap.clientHeight;
                
                if (itC.animation === 2) {
                    tD.prevnext = tC.nowY - tC.startY;
                    tC.length = Math.round(Math.abs((tC.startY - tC.nowY) / itSt.curHeight * 100));
                }
                else {
                    tD.prevnext = tC.nowX - tC.startX
                    tC.length = Math.round(Math.abs((tC.startX - tC.nowX) / itSt.curWidth * 100));
                }
                
                if (itC.bgAnimation === 1) {x = 1;}
                else if (itC.bgAnimation === 2) {x = -1;}
                
                if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 3)) {
                    
                    //try view previous background
                    if (0 < tD.prevnext) {
                        
                        if (itSt.curPage === 0) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.background[itSt.maxPage].style.opacity = tC.length * 0.01;
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.background[itSt.maxPage].style.opacity = tC.length * 0.01;
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.background[itSt.curPage - 1].style.opacity = tC.length * 0.01;
                            }
                        }
                    }
                    //try view next background
                    else {
                        
                        if (itSt.curPage === itSt.maxPage) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.background[0].style.opacity = tC.length * 0.01;
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.background[0].style.opacity = tC.length * 0.01;
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.background[itSt.curPage].style.opacity = (100 - tC.length) * 0.01;
                                itEl.background[itSt.curPage + 1].style.opacity = tC.length * 0.01;
                            }
                        }
                    }
                }
                
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                    //try view previous background
                    if (0 < tD.prevnext) {

                        if (itSt.curPage === 0) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.left = x * tC.length + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.background[itSt.curPage].style.left = x * tC.length + '%';
                                itEl.background[itSt.maxPage].style.left = x * (tC.length - 100) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.left = x * tC.length + '%';
                                itEl.background[itSt.maxPage].style.left = x * (tC.length + 100) + '%';
                            }
                        }

                        else {
                            if (tC.length <= 100) {
                                itEl.background[itSt.curPage].style.left = x * tC.length + '%';
                                itEl.background[itSt.curPage - 1].style.left = x * (tC.length - 100) + '%';
                            }
                        }
                    }
                    //try view next background
                    else if (0 > tD.prevnext) {

                        if (itSt.curPage === itSt.maxPage) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.left = x * (0 - tC.length) + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.background[itSt.curPage].style.left = x * (0 - tC.length) + '%';
                                itEl.background[0].style.left = x * (100 - tC.length) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.left = x * (0 - tC.length) + '%';
                                itEl.background[0].style.left = x * (-100 - tC.length) + '%';
                            }
                        }

                        else {
                            if (tC.length <= 100) {
                                itEl.background[itSt.curPage].style.left = x * (0 - tC.length) + '%';
                                itEl.background[itSt.curPage + 1].style.left = x * (100 - tC.length) + '%';
                            }
                        }
                    }
                }
                else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                    
                    //try view previous background
                    if (0 < tD.prevnext) {
                        
                        if (itSt.curPage === 0) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.top = x * tC.length + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.background[itSt.curPage].style.top = x * tC.length + '%';
                                itEl.background[itSt.maxPage].style.top = x * (tC.length - 100) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.top = x * tC.length + '%';
                                itEl.background[itSt.maxPage].style.top = x * (tC.length + 100) + '%';
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.background[itSt.curPage].style.top = x * tC.length + '%';
                                itEl.background[itSt.curPage - 1].style.top = x * (tC.length - 100) + '%';
                            }
                        }
                    }
                    //try view next background
                    else if (0 > tD.prevnext) {
                        
                        if (itSt.curPage === itSt.maxPage) {
                            if (itC.loop === 0 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.top = x * (0 - tC.length) + '%';
                            }
                            else if (itC.loop === 1 && tC.length <= 100) {
                                itEl.background[itSt.curPage].style.top = x * (0 - tC.length) + '%';
                                itEl.background[0].style.top = x * (100 - tC.length) + '%';
                            }
                            else if (itC.loop === 2 && tC.length <= 30) {
                                itEl.background[itSt.curPage].style.top = x * (0 - tC.length) + '%';
                                itEl.background[0].style.top = x * (-100 - tC.length) + '%';
                            }
                        }
                        
                        else {
                            if (tC.length <= 100) {
                                itEl.background[itSt.curPage].style.top = x * (0 - tC.length) + '%';
                                itEl.background[itSt.curPage + 1].style.top = x * (100 - tC.length) + '%';
                            }
                        }
                    }
                }
            }
            
            //if invalid previous touch, content location restore animation run
            var restoreLocationPrevConAni = function(i) {
                var c, s, itC = slider[i].code, itEl = slider[i].element;
                c = arguments[1];
                if (arguments.length === 3) {s = arguments[2]}
                
                //state play pause
                changePlaypause(i, 1);

                //animation for browsers that can use transitions
                var canTransitionAni = function() {
                    if (itC.animation === 0) {
                        itEl.content[c].style.opacity = '1';
                        if (arguments.length === 3) {
                            itEl.content[s].style.opacity = '0';
                            setTimeout(restoreAnimationEnd, 50, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, 50, i, c);
                        }
                    }
                    else if (itC.animation === 1) {
                        itEl.content[c].style.left = '0%';
                        if (arguments.length === 3) {
                            itEl.content[s].style.left = '-100%';
                            setTimeout(restoreAnimationEnd, itC.duration, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, itC.duration, i, c);
                        }
                    }
                    else if (itC.animation === 2) {
                        itEl.content[c].style.top = '0%';
                        if (arguments.length === 3) {
                            itEl.content[s].style.top = '-100%';
                            setTimeout(restoreAnimationEnd, itC.duration, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, itC.duration, i, c);
                        }
                    }
                    else if (itC.animation === 3) {
                        itEl.content[c].style.opacity = '1';
                        if (arguments.length === 3) {
                            itEl.content[s].style.opacity = '0';
                            setTimeout(restoreAnimationEnd, itC.duration, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, itC.duration, i, c);
                        }
                    }
                }

                //can use transitions
                if (typeof document.body.style.transition === 'string') {
                    itEl.content[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.content[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                    }
                    if (arguments.length === 3) {
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }

                //can use -webkit-transitions
                else if (typeof document.body.style.webkitTransition === 'string') {
                    itEl.content[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.content[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                    }
                    if (arguments.length === 3) {
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }

                //when enable background
                if (itC.background === 1) {

                    //run background animation
                    if (itC.bgAnimation === 2) {
                        if (arguments.length === 3) {
                            restoreLocationNextBgAni(i, c, s);
                        }
                        else {
                            restoreLocationNextBgAni(i, c);
                        }
                    }
                    else {
                        if (arguments.length === 3) {
                            restoreLocationPrevBgAni(i, c, s);
                        }
                        else {
                            restoreLocationPrevBgAni(i, c);
                        }
                    }
                }
            }
            
            //if invalid next touch, content location restore animation run
            var restoreLocationNextConAni = function(i) {
                var c, s, itC = slider[i].code, itEl = slider[i].element;
                c = arguments[1];
                if (arguments.length === 3) {s = arguments[2]}
                
                //state play pause
                changePlaypause(i, 1);

                //animation for browsers that can use transitions
                var canTransitionAni = function() {
                    if (itC.animation === 0) {
                        itEl.content[c].style.opacity = '1';
                        if (arguments.length === 3) {
                            itEl.content[s].style.opacity = '0';
                            setTimeout(restoreAnimationEnd, 50, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, 50, i, c);
                        }
                    }
                    else if (itC.animation === 1) {
                        itEl.content[c].style.left = '0%';
                        if (arguments.length === 3) {
                            itEl.content[s].style.left = '100%';
                            setTimeout(restoreAnimationEnd, itC.duration, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, itC.duration, i, c);
                        }
                    }
                    else if (itC.animation === 2) {
                        itEl.content[c].style.top = '0%';
                        if (arguments.length === 3) {
                            itEl.content[s].style.top = '100%';
                            setTimeout(restoreAnimationEnd, itC.duration, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, itC.duration, i, c);
                        }
                    }
                    else if (itC.animation === 3) {
                        itEl.content[c].style.opacity = '1';
                        if (arguments.length === 3) {
                            itEl.content[s].style.opacity = '0';
                            setTimeout(restoreAnimationEnd, itC.duration, i, c, s);
                        }
                        else {
                            setTimeout(restoreAnimationEnd, itC.duration, i, c);
                        }
                    }
                }

                //can use transitions
                if (typeof document.body.style.transition === 'string') {
                    itEl.content[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.content[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                    }
                    if (arguments.length === 3) {
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }

                //can use -webkit-transitions
                else if (typeof document.body.style.webkitTransition === 'string') {
                    itEl.content[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.content[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                    }
                    if (arguments.length === 3) {
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }

                //when enable background
                if (itC.background === 1) {

                    //run background animation
                    if (itC.bgAnimation === 2) {
                        if (arguments.length === 3) {
                            restoreLocationPrevBgAni(i, c, s);
                        }
                        else {
                            restoreLocationPrevBgAni(i, c);
                        }
                    }
                    else {
                        if (arguments.length === 3) {
                            restoreLocationNextBgAni(i, c, s);
                        }
                        else {
                            restoreLocationNextBgAni(i, c);
                        }
                    }
                }
            }
            
            //if invalid previous touch, background location restore animation run
            var restoreLocationPrevBgAni = function(i) {
                var c, s, itC = slider[i].code, itEl = slider[i].element;
                c = arguments[1];
                if (arguments.length === 3) {s = arguments[2]}

                //animation for browsers that can use transitions
                var canTransitionAni = function() {
                    if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                        itEl.background[c].style.opacity = '1';
                        if (arguments.length === 3) {
                            itEl.background[s].style.opacity = '0';
                        }
                    }
                    else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                        itEl.background[c].style.left = '0%';
                        if (arguments.length === 3) {
                            itEl.background[s].style.left = '-100%';
                        }
                    }
                    else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                        itEl.background[c].style.top = '0%';
                        if (arguments.length === 3) {
                            itEl.background[s].style.top = '-100%';
                        }
                    }
                }

                //can use transitions
                if (typeof document.body.style.transition === 'string') {
                    itEl.background[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.background[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }

                //can use -webkit-transitions
                else if (typeof document.body.style.webkitTransition === 'string') {
                    itEl.background[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.background[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }
                
            }
            
            //if invalid next touch, background location restore animation run
            var restoreLocationNextBgAni = function(i) {
                var c, s, itC = slider[i].code, itEl = slider[i].element;
                c = arguments[1];
                if (arguments.length === 3) {s = arguments[2]}

                //animation for browsers that can use transitions
                var canTransitionAni = function() {
                    if ((itC.bgAnimation === 0) || ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && (itC.animation === 0 || itC.animation === 3))) {
                        itEl.background[c].style.opacity = '1';
                        if (arguments.length === 3) {
                            itEl.background[s].style.opacity = '0';
                        }
                    }
                    else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 1) {
                        itEl.background[c].style.left = '0%';
                        if (arguments.length === 3) {
                            itEl.background[s].style.left = '100%';
                        }
                    }
                    else if ((itC.bgAnimation === 1 || itC.bgAnimation === 2) && itC.animation === 2) {
                        itEl.background[c].style.top = '0%';
                        if (arguments.length === 3) {
                            itEl.background[s].style.top = '100%';
                        }
                    }
                }

                //can use transitions
                if (typeof document.body.style.transition === 'string') {
                    itEl.background[c].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.background[s].style.transition = 'all ' + (itC.duration * 0.001) + 's ease';
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }

                //can use -webkit-transitions
                else if (typeof document.body.style.webkitTransition === 'string') {
                    itEl.background[c].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                    if (arguments.length === 3) {
                        itEl.background[s].style.webkitTransition = 'all ' + (itC.duration * 0.001) + 's ease';
                        canTransitionAni(1, c, s);
                    }
                    else {
                        canTransitionAni(1, c);
                    }
                }
            }

            //set attribute when animation end
            var restoreAnimationEnd = function(i) {
                var c, s, itC = slider[i].code, itEl = slider[i].element, itSt = slider[i].state;
                c = arguments[1];
                if (arguments.length === 3) {s = arguments[2]}
                
                //state play getback
                changePlaypause(i, 0);

                //remove attribute transition
                if (typeof document.body.style.transition === 'string') {
                    itEl.content[c].style.transition = '';
                    if (arguments.length === 3) {
                        itEl.content[s].style.transition = '';
                    }
                    if (itC.background === 1) {
                        itEl.background[c].style.transition = '';
                        if (arguments.length === 3) {
                            itEl.background[s].style.transition = '';
                        }
                    }
                }

                //remove attribute -webkit-transition
                else if (typeof document.body.style.webkitTransition === 'string') {
                    itEl.content[c].style.webkitTransition = '';
                    if (arguments.length === 3) {
                        itEl.content[s].style.webkitTransition = '';
                    }
                    if (itC.background === 1) {
                        itEl.background[c].style.webkitTransition = '';
                        if (arguments.length === 3) {
                            itEl.background[s].style.webkitTransition = '';
                        }
                    }
                }

                //animation state reset
                itSt.animation = 0;
                
                changePlaypause(i, 0);
            }
            
            return {
                s: start,
                m: move,
                e: end
            }
        }());
        
        //get slider value
        var getSlider = function(i, val) {
            switch (val) {
                case 'curPage':
                    return slider[i].state.curPage;
                case 'maxPage':
                    return slider[i].state.maxPage;
                case 'length':
                    return slider[i].state.l;
                case 'playState':
                    return slider[i].state.play;
                case 'ctrlBtn':
                    return slider[i].element.conBtn;
                case 'prevBtn':
                    return slider[i].element.prevBtn;
                case 'nextBtn':
                    return slider[i].element.nextBtn;
                case 'content':
                    if (arguments.length === 3) {
                        return slider[i].element.content[arguments[2]];
                    }
                    else {
                        break;
                    }
                case 'background':
                    if (arguments.length === 3) {
                        return slider[i].element.background[arguments[2]];
                    }
                    else {
                        break;
                    }
                case 'carousel':
                    if (arguments.length === 3) {
                        return slider[i].element.carousel[arguments[2]];
                    }
                    else {
                        break;
                    }
                default:
                    break;
            }
        }
        
        //function that allows user to control the slider directly
        var userFunction = function(i, val) {
            switch (val) {
                case 'playToggle':
                    conBtn(i);
                    break;
                case 'goTo':
                    if (arguments.length === 3) {
                        goToSel(i, arguments[2]);
                        break;
                    }
                    else {
                        break;
                    }
                default:
                    break;
            }
        }
        
        //user event running
        var runEvent = function(i, c, s) {
            if (slider[i].event) return slider[i].event(slider[i].state.id, c, s);
        }
        
        return {
            set: createSliderArray,
            get: getSlider,
            ctrl: userFunction,
        }
    }());
}
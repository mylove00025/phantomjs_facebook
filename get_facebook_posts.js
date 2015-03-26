// Author: HungPT
// Usage:
//     phantomjs facebook_posts.js [facebookId] [facebookUrl]
// ========================================

var page = require("webpage").create(),
	fs = require("fs"),
	sys = require('system');

var facebookId = sys.args[1];

var facebookUrl = sys.args[2];

var loadInProgress = false;
var loginScriptDone = false;
var commentScriptDone = false;

// Store all post elements
var postElements = [];

// Store all post contents
var postContents = [];

// Store created time of all posts
var postTimes = [];

// The script to log in facebook
var loginScript = [];

// The script to get comments of posts
var getCommentScript = [];

// The script to get likes and shares of posts
var getLikeShareScript = [];

// All posts
var posts = [];

// Config
var config = JSON.parse(fs.read("C:/phantomjs-2.0.0/examples/career_score/config.json"));

// Route "console.log()" calls from within the Page context to the main Phantom context (i.e. current "this")
page.onConsoleMessage = function(msg) {
    console.log(msg);
};

page.onLoadStarted = function() {
	loadInProgress = true;
	console.log("Loading...\n");
};

page.onLoadFinished = function() {
	loadInProgress = false;
	console.log("Load Finished.\n");
};

page.onPageCreated = function(newPage) {
    page = newPage;
    console.log("New window opened.\n");
};

page.viewportSize = {width:1280, height:20000};

console.log("************* Starting to crawl timeline facebookId = " + facebookId + " **************\n");

// Login script
loginScript = [
	function() {
		// Open facebook to login
        page.open(facebookUrl, function (status) {
			if (status !== "success") {
				console.log("Unable to access the facebook\n");
				phantom.exit();
			}
		});
    },
	function() {
		// Login facebook
		page.evaluate(function(username, password) {
			document.querySelector("#email").value = username;
			document.querySelector("#pass").value = password;
			document.querySelector("#loginbutton input").click();
		}, config.users.user1.username, config.users.user1.password);
	},
	function() {
		// Open user page
		page.open(facebookUrl, function (status) {
			if (status !== "success") {
				console.log("Unable to access to user page with facebookId = " + facebookId);
				phantom.exit();
			}
		});
    },
	function() {
		// Scroll to get more posts
		loadInProgress = true;
			
		var checkScroll = page.evaluate(function() {
			window.document.body.scrollTop = document.body.scrollHeight;
			return true;
		});
		
		intervalScroll = setInterval(function() {
			var seeMore = page.evaluate(function() {
				return (document.querySelector("div.fbTimelineSectionExpander div.fbTimelineSectionExpandPager div.uiMorePager a.uiMorePagerPrimary") != null);
			});
			if (checkScroll && seeMore) {
				clearInterval(intervalScroll);
				loadInProgress = false;
			}
		}, 5000);
	},
	function() {
		// Get all post elements
		postElements = page.evaluate(function() {
			return [].map.call(document.querySelectorAll("div#timeline_tab_content form.commentable_item"), function(form) {
				return form.getAttribute("class");
			});
		});
	},
	function() {
		// Get all post contents
		postContents = page.evaluate(function() {
			return [].map.call(document.querySelectorAll("div#timeline_tab_content div.userContentWrapper div.userContent"), function(item) {
				var childs = item.childNodes;
				if (childs.length > 0) {
					return childs[0].innerHTML;
				}
				return "";
			});
		});
	},
	function() {
		// Get post times
		postTimes = page.evaluate(function() {
			return [].map.call(document.querySelectorAll("div#timeline_tab_content div._4-u2.mbm"), function(div) {
				return div.getAttribute("data-time");
			});
		});
	},
]

// Run login script
var index1 = 0;
interval1 = setInterval(function() {
    if (!loadInProgress && typeof loginScript[index1] == "function") {
        loginScript[index1]();
        index1++;
    }
 
    if (typeof loginScript[index1] != "function") {
		clearInterval(interval1);
		
		for (i = 0; i < postElements.length; i++) {
			var dataLive = postElements[i].split(" ")[0];
			var postId = dataLive.split("_")[1];
			
			posts[i] = {};
			posts[i].id = postId;
			posts[i].dataLive = dataLive;
			posts[i].message = postContents[i];
			posts[i].created_time = postTimes[i];
			
			getCommentScript[2*i] = function(i, dataLive) {
				// Load all comments of the post
				page.evaluate(function(dLive) {
					var pager = document.querySelector("form." + dLive + " ul.UFIList li.UFIPagerRow a.UFIPagerLink");
					if (pager != null) {
						pager.click();
					}
				}, dataLive);
			};
			
			getCommentScript[2*i + 1] = function(i, dataLive) {
				// Get all comments of the post
				var comments = page.evaluate(function(dLive) {
					return [].map.call(document.querySelectorAll("form." + dLive + " ul.UFIList li.UFIComment a.UFIImageBlockImage"), function(item) {
						var match = item.getAttribute("data-hovercard").match(/id=([0-9]+)\&/);
						return {"id" : match[1]};
					});
				}, dataLive);
				posts[i].comments = {
					"data" : comments,
					"summary" : {"total_count" : comments.length},
				};
			};

			getLikeShareScript[4*i] = function(i, id) {
				// Open like page of the post
				page.open("https://www.facebook.com/browse/likes?id=" + id + "&actorid=" + facebookId, function (status) {
					if (status !== "success") {
						console.log("Unable to get likes postId = " + id);
					}
				});
			};
			
			getLikeShareScript[4*i + 1] = function(i, id) {
				// Get all likes of the post
				var likes = page.evaluate(function() {
					return [].map.call(document.querySelectorAll("div.fbProfileBrowserList ul li.fbProfileBrowserListItem a._8o._8t"), function(item) {
						var match = item.getAttribute('data-hovercard').match(/id=([0-9]+)\&/);
						return {"id" : match[1]};
					});
				});
				posts[i].likes = {
					"data" : likes,
					"summary" : {"total_count" : likes.length},
				};
			};
			
			getLikeShareScript[4*i + 2] = function(i, id) {
				// Open share page of the post
				page.open("https://www.facebook.com/shares/view?id=" + id, function (status) {
					if (status !== "success") {
						console.log("Unable to get likes postId = " + id);
					}
				});
			};
			
			getLikeShareScript[4*i + 3] = function(i, id) {
				// Get al shares of the post
				var shares = page.evaluate(function() {
					return [].map.call(document.querySelectorAll("div._5pcb div div.userContentWrapper div a._5pb8._5v9u"), function(item) {
						var match = item.getAttribute("data-hovercard").match(/id=([0-9]+)\&/);
						return {"id" : match[1]};
					});
				});
				posts[i].shares = {
					"data" : shares,
					"summary" : {"total_count" : shares.length},
				};
			};
		}
		
		loginScriptDone = true;
		loadInProgress = false;
    }
}, 3000);

// Run script to get comments
var index2 = 0;
interval2 = setInterval(function() {
    if (loginScriptDone && !loadInProgress && typeof getCommentScript[index2] == "function") {
		var postIndex = Math.floor(index2 / 2);
        getCommentScript[index2](postIndex, posts[postIndex].dataLive);
        index2++;
    }
 
    if (loginScriptDone && typeof getCommentScript[index2] != "function") {
		clearInterval(interval2);

		commentScriptDone = true;
		loadInProgress = false;
    }
}, 3000);

// Run script to get likes and shares
var index3 = 0;
interval3 = setInterval(function() {
    if (commentScriptDone && !loadInProgress && typeof getLikeShareScript[index2] == "function") {
		var postIndex = Math.floor(index3 / 4);
        getLikeShareScript[index3](postIndex, posts[postIndex].id);
        index3++;
    }
 
    if (commentScriptDone && typeof getLikeShareScript[index3] != "function") {
		clearInterval(interval3);
		var timeline = {
			"data" : posts
		};
		fs.write("C:/phantomjs-2.0.0/examples/career_score/timeline.json", JSON.stringify(timeline), 'w');
		console.log("************* Ended to crawl timeline facebookId = " + facebookId + " **************\n");
        phantom.exit();
    }
}, 3000);
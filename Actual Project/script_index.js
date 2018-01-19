// Basic variables
var posts = []; // Containing posts from all the people you follow
var ajax_requests = []; // Used to store Deferred objects for all ajax requests (helps with waiting for all requests to finish)
var colors = {}; // The current user's colors (YOU)
var user_profile = {}; // The current user's entire profile.json (YOU AGAIN) so we don't have to load it multiple times later.
var following = []; // All the people you follow
var selfUrl = "" + window.location; // The current URL TODO: Maybe parse this so it's the absolute URL of the page
var archive = new DatArchive(selfUrl); // Turn the site into the object it is.

/**
 * Prototype for formatting strings 
 * ex. "{1} is {2}".format("cake", "good") -> "cake is good"
 */
String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
        ;
    });
};

/**
 * Prototype for truncating strings and adding
 * "..." if it was shortened.
 */
String.prototype.trunc = function(n){
    return (this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
};

/**
 * Loop through all the people you follow and add event listeners
 * to see when they make a new post.
 */
async function addFollowingEvents() {
    for (var i = 0; i < following.length; i++) {
        
        let ok = true; // Status to check if there are no errors trying to reach other users
        let person = new DatArchive(following[i]); // The user we are trying to get posts from, including yourself.
        
        var fileEvents = person.createFileActivityStream(); // Open an activity checker so we get live updates when a user makes a new post.
        // TODO: Make sure above works.
        var last_file = ""; // What the last file was
        /**
         * Since all /posts/ directories end with a file called last.json we need to check for that
         * it helps keep track of when it's time to move to the next user/ we've gotten all posts,
         * since we don't know how many posts the user has
         */

        // Info about the archive/site
        let info = await person.getInfo();

        console.log("Create handler for: " + info.url + " | " + info.title);
        fileEvents.addEventListener("invalidated", e => {
            // Regex to check wether or not the event popped up in the posts folder.
            let re = /\/posts\/.*\.json/;

            // Read the file at the path that changed
            person.readFile(e.path).then(file => {

                // Use the RegEx to check if it's worth bothering with.
                if (e.path.match(re)) {
                    // If it's the last file there's no need to keep running the loop so just end it.
                    if (last_file == file) {
                        return;
                    } else {
                        // Otherwise, get the file and add it to the top of the feed.
                        let j = JSON.parse(file);
                        last_file = file;
                        $("#feed").prepend(buildPost(j));
                        console.log(j.user + " posted");
                    }
                }
            }).catch(function () {
                console.log("User cannot be reached, most likely because they're offline and nobody has their site...");
            });
        });
    }
    return "Created events";
}


/**
 * Initiate the posts folder if it doesn't already exist.
 * This can probably done another way without it throwing an error but
 * it's fine.
 */
archive.mkdir('/posts').then(function () {
    // Create the last.json file which helps the feed script handle posts
    archive.writeFile("/posts/last.json", JSON.stringify({
        "timestamp": "last post"
    }, null, "\t")).then(function () {
        archive.commit();
    });

}).catch(function () {
    console.log("Can't override the already existing folder, but it's ok!");
});



// ========[ Build the profile ]========
$.ajax({
    // Request for your own profile.json to get info about yourself
    /**
     * Sadly, this needs to be async: false, until a better solution atleast
     * since most functionality depends on this finishing and filling the arrays
     */
    type: "GET",
    dataType: "json",
    async: false,
    url: "/profile.json",
    success: function (data) {
        $("#thumb img").attr("src", data.profile_pic); // Set your profile pic
        $("#username").text(data.username); // Set your username
        $("#bio p").text(data.bio); // Set your bio
        $("title").text(data.username + " | Feed"); // And set the title of the page to something cooler.

        // Since I'm reading the profile.json here I might aswell make the needed variables
        following = data.following;
        // Add yourself to the following list so its easier to get your own posts
        following.push(archive.url);
        // Move it to a variable for easy access later
        user_profile = data;

        // Set all the colors in easy to access variables
        colors.accent = data.accent_color;
        colors.background = data.background_color;
        colors.sbackground = data.secondary_background;
        colors.sfontdark = data.secondary_font_dark;
        colors.sfontlight = data.secondary_font_light;
    }
});


// ========[ Feed Form ]========
/**
 * Whenever the form is submitted (it shouldn't be sent to a server that's for sure)
 */
$("#feed-content form").on("submit", function (e) {
    e.preventDefault();

    let json = {}; // Container for everything

    // Parse the content and replace newlines with breaklines since html doesnt get newlines
    let content = $("textarea", this).val().replace(/\n/g, "<br>");

    let timestamp = Math.floor(Date.now()); // Get the current timestamp
    let user = $("#username").text(); // Current user
    let user_image = archive.url + $("#profile img").attr("src"); // User Image
    let user_page = archive.url; // The start url of the user

    $("textarea", this).val("");

    json["content"] = content;
    json["timestamp"] = timestamp;
    json["user"] = user;
    json["user_image"] = user_image;
    json["user_page"] = user_page;
    json["user_color"] = colors.accent;
    json["id"] = sha256(user + archive.url);
    json["op"] = user;
    json["op_color"] = colors.accent;
    json["op_page"] = archive.url;
    json["total_reposts"] = 0;
    json["file_location"] = `${archive.url}/posts/${timestamp}.json`;

    archive.getInfo().then(a => {
        if (a.isOwner) {
            archive.writeFile(`/posts/${timestamp}.json`, JSON.stringify(json, null, "\t")).then(function () {
                archive.commit();
                console.log("Officially submitted original content!");
                let post = buildPost(json);
                $("#feed").prepend(post);
            });
        }
    });
});


let last_count = 0;
let ready_run = false;

function getPosts() {
    /**
     * Get all the posts in your feed, including your own
     * TODO: Your posts shouldnt show up in your feed (messy when reposting)
     */
    for (var i = 0; i < following.length; i++) {
        let ok = true;
        let person = new DatArchive(following[i]);
        
        person.stat("/").catch(function() {
            console.log("THERES NAH STATUS");
            ok = false;
        });

        if(ok == false) {
            continue;
        }

        person.readdir("/posts").then(files => {

            // For some reasons the file orders got reversed... just making sure.
            let f = ((files[0] == "last.json") ? files.reverse() : files);


            for (var j = 0; j < f.length; j++) {
                $.ajax({
                    url: person.url + "/posts/" + f[j]
                }).done(function (data) {

                    if (data.timestamp != "last post") {
                        posts.push(data);
                    }

                }).always(function (data, status) {
                    if (data.timestamp == "last post") {

                        last_count++;

                        if (last_count == following.length) {
                            ready_run = true;
                        }
                    }
                });
            }
        });
    }
}



let last_index = 0;

function handleData() {
    let sorted = posts.sort(function (a, b) {
        return b.timestamp - a.timestamp;
    });

    let sec = last_index;
    let the_end = false;

    for (var i = sec; i < sec + 5; i++) {
        if (i == sorted.length) {
            $(".spinner").hide();
            $(".no-more").css("display", "flex");
            the_end = true;
            break;
        } else {
            let c = sorted[i]; // Current element to build the template from
            try {
                let post = buildPost(c);
                $("#feed #loading-icon").before(post);    
            } catch(e) {
                console.log("Outdated user: " + c.user + " | " + c.user_page);
            }
            last_index++;
        }
    }

    if (the_end == false) {
        $(".spinner").hide();
        $(".load-more").css("display", "flex");
    }
}

function buildPost(json) {
    let is_repost = false;
    let poster = `<a href="${json.user_page}" style="color:${colors.accent};">${json.user}`;
    let chevron = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24">
                        <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                   </svg>`;

    // Check if we're not the original poster
    // No point in showing it's a repost if you reposted your own content,
    // no idea why you would do that but just in case.
    if(json.op != json.user) {
        poster = poster + chevron + `<a href="${json.op_page}">${json.op}</a></a>`;
    } else {
        poster = poster + "</a>";
    }

    return `<div class="post-item" id=\"${json.timestamp}\" alt="">  
                <header style="border-color:${colors.accent};">
                    <div class="thumb"><img src="${json.user_image}"></div>
                    ${poster}
                </header>
                <main>
                    <div>${json.content}</div>
                    <footer>
                        <!-- The link to the post for easy access on reposts -->
                        <a href="${json.file_location}" style="display: none"></a>
                        <section class="repost-button">
                            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24">
                                <path d="M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z" />
                            </svg>
                            Repost
                        </section>
                        <section class="user-id">${json.id.trunc(20)}</section>    
                    </footer>
                </main>
            </div>`;
}



// If we're on the feed page
if (selfUrl.endsWith("/sites_customise.html") || selfUrl.endsWith("/sites_following.html")) {
    console.log("No need to get posts since we're not in the feed. It's OK!");
} else {
    getPosts();
    addFollowingEvents();
}



// EVENTS

$(document).ready(function () {

    // When the last ajax is done, the chackras should align and this will be true
    var done_check = setInterval(function () {
        if (ready_run == true && following.length == last_count) {
            handleData();
            clearInterval(done_check);
            ready_run = false;
        }
    }, 1000);

    $(document).on("click", ".load-more", function () {
        $(".load-more").css("display", "none");
        $(".spinner").show();
        handleData();
    });

    $(document).on("click", ".no-more", function () {
        $('html,body').animate({
            scrollTop: 0
        }, 0);
    });

    $(document).on("click", ".post-item main img", function () {
        $(this).toggleClass("resize-center");
    });

    let status = false;
    let menu_icon = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\">" +
        "<path d=\"M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z\" />" +
        "</svg>";
    let close_icon = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\">" +
        "<path d=\"M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z\" />" +
        "</svg>";

    $("#menu-button").on("click", function () {
        if (status == false) {
            $("#menu-items").css("margin-left", "0");
            $(this).css("left", "70").html(close_icon);
            $("#profile").css("left", "50");

            status = true;
        } else {
            $("#menu-items").css("margin-left", "-50");
            $(this).css("left", "20").html(menu_icon);
            $("#profile").css("left", "0");

            status = false;
        }
    });

    $(document).on("click", ".repost-button", function() {
        // Get the url to the file
        let location = $(this).parent().parent().find("a").attr("href");
        
        // Call for that url
        // TODO: If it failed you should change the repost icon and replace it with an error
        $.ajax({
            url: location
        }).done(function(data) {
            let json = data; // Container for everything 
            let timestamp = Math.floor(Date.now()); // Get the current timestamp
            let user = $("#username").text(); // Current user
            let user_image = archive.url + $("#profile img").attr("src"); // User Image
            let user_page = archive.url; // The start url of the user
        
            json["timestamp"] = timestamp;
            json["op"] = json.user;
            json["op_color"] = json.user_color;
            json["op_page"] = json.user_page;
            json["user"] = user;
            json["user_image"] = user_image;
            json["user_page"] = user_page;
            json["user_color"] = colors.accent;
            json["id"] = sha256(user + archive.url);
            json["total_reposts"] = parseInt(json["total_reposts"] + 1);
            json["file_location"] = `${archive.url}/posts/${timestamp}.json`;
        
            archive.getInfo().then(a => {
                if (a.isOwner) {
                    archive.writeFile(`/posts/${timestamp}.json`, JSON.stringify(json, null, "\t")).then(function () {
                        archive.commit();
                        console.log("Officially stole someones post!");
                        let post = buildPost(json);
                        $("#feed").prepend(post);
                    });
                }
            });
        });
    });
});

/**
 * 
 * 
 *      RUN THIS WHENEVER YOU WANT YOUR NEW COLORS TO BE VISIBLE
 *                         ON THE PAGE!!!!!!
 * 
 *      Make sure you backed up warning... TODO:!!!
 * 
 * 
 */

function rebuild() {

    archive.getInfo().then(current => {
    
        if(current.isOwner) {   // Check if the one making the change is owner, just so we dont waste power.
    
            console.log("[ Status ]: Getting profile...");
    
            $.ajax({    // Call for the current profile
                type: "GET",
                dataType: "json",
                url: "/profile.json",
                success: function(data) {
    
                    console.log("\tAccent     -> " + data.accent_color);
                    console.log("\tBackground -> " + data.background_color);
                    console.log("\tMain font  -> " + data.main_font_color);
                    console.log("\tSec font   -> " + data.secondary_font_color);

                    console.log("[ Status ]: Getting template...");
                    
                    archive.readFile("/style_template.css").then(t => {
                        console.log("[ Status ]: Converting colors to RGB...");

                        // Load in all the colors and turn them into rbg format
                        let ac = hexToRgb(data.accent_color);
                        let bc = hexToRgb(data.background_color);
                        let sb = hexToRgb(data.secondary_background);
                        let sfd = hexToRgb(data.secondary_font_dark);
                        let sfl = hexToRgb(data.secondary_font_light);

                        console.log("[ Status ]: Replacing colors...");

                        let tmp = t.replace(/\$BACKGROUND_COLOR/g, buildRgba(bc, 1))
                                   .replace(/\$ACCENT_COLOR/g, buildRgba(ac, 1))
                                   .replace(/\$SECONDARY_FONT_LIGHT/g, buildRgba(sfl, 1))
                                   .replace(/\$SECONDARY_FONT_DARK/g, buildRgba(sfd, 1))
                                   .replace(/\$ACCENT_ON_HOVER/g, buildRgba(ac, 0.46))
                                   .replace(/\$SECONDARY_BACKGROUND/g, buildRgba(sb, 1));

                        console.log("[ Status ]: Writing to original file...");
                        archive.writeFile("/style_main.css", tmp);
                        archive.commit();
                        location.reload();
                    })
                }
            });
        
        } else {
            console.log("[!!]: You're not owner!");
        }
    });
}


function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function buildRgba(obj, alpha) {
    return "rgba({0}, {1}, {2}, {3})".format(obj.r, obj.g, obj.b, alpha);
}


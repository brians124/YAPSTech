package com.yaps.music;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Reads the phone's music library (Android MediaStore).
 *   hasAccess()      -> { granted }
 *   requestAccess()  -> { granted }   (shows the system "Allow music access" dialog)
 *   getSongs()       -> { songs: [ { id, title, artist, album, duration(sec), uri, path, name, added(sec) } ] }
 */
@CapacitorPlugin(
    name = "MusicLibrary",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class MusicLibraryPlugin extends Plugin {

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    private boolean granted() {
        return getPermissionState(alias()) == PermissionState.GRANTED;
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (granted()) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
            return;
        }
        requestPermissionForAlias(alias(), call, "accessCallback");
    }

    @PermissionCallback
    private void accessCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void getSongs(final PluginCall call) {
        if (!granted()) {
            call.reject("PERMISSION");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Uri collection = Build.VERSION.SDK_INT >= 29
                        ? MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                        : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                    String[] projection = {
                        MediaStore.Audio.Media._ID,
                        MediaStore.Audio.Media.TITLE,
                        MediaStore.Audio.Media.ARTIST,
                        MediaStore.Audio.Media.ALBUM,
                        MediaStore.Audio.Media.DURATION,
                        MediaStore.Audio.Media.DATE_ADDED,
                        MediaStore.Audio.Media.DISPLAY_NAME,
                        MediaStore.Audio.Media.DATA
                    };
                    // real music only: skips ringtones/voice notes and clips under 30 seconds
                    String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " >= 30000";
                    JSArray songs = new JSArray();
                    Cursor c = getContext().getContentResolver().query(
                        collection, projection, selection, null, MediaStore.Audio.Media.DATE_ADDED + " DESC");
                    if (c != null) {
                        try {
                            int iId = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                            int iTitle = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                            int iArtist = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                            int iAlbum = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                            int iDur = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                            int iAdded = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED);
                            int iName = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
                            int iData = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
                            while (c.moveToNext()) {
                                long id = c.getLong(iId);
                                String artist = c.getString(iArtist);
                                if (artist != null && artist.equals("<unknown>")) artist = "";
                                JSObject o = new JSObject();
                                o.put("id", id);
                                o.put("title", c.getString(iTitle));
                                o.put("artist", artist == null ? "" : artist);
                                o.put("album", c.getString(iAlbum));
                                o.put("duration", c.getLong(iDur) / 1000.0);
                                o.put("added", c.getLong(iAdded));
                                o.put("name", c.getString(iName));
                                o.put("path", c.getString(iData));
                                o.put("uri", ContentUris.withAppendedId(collection, id).toString());
                                songs.put(o);
                            }
                        } finally {
                            c.close();
                        }
                    }
                    JSObject r = new JSObject();
                    r.put("songs", songs);
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject("Could not read the music library: " + e.getMessage());
                }
            }
        }).start();
    }
}

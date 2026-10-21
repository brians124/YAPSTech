package com.yaps.music;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MusicLibraryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

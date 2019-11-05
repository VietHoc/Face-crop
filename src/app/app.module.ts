import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AvatarComponent } from './avatar/avatar.component';
import { ImageCropperModule } from 'ngx-image-cropper';
import {WebcamModule} from 'ngx-webcam';
import {NgOpenCVModule, OpenCVOptions} from 'ng-open-cv';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatButtonModule, MatCardModule, MatDialogModule, MatDialogRef, MatGridListModule, MatSnackBarModule} from '@angular/material';
import {HttpClientModule} from '@angular/common/http';
import { DialogTakePhotoComponent } from './dialog-take-photo/dialog-take-photo.component';

const openCVConfig: OpenCVOptions = {
  scriptUrl: `assets/opencv/opencv.js`,
  wasmBinaryFile: 'wasm/opencv_js.wasm',
  usingWasm: true
};


@NgModule({
  declarations: [
    AppComponent,
    AvatarComponent,
    DialogTakePhotoComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ImageCropperModule,
    WebcamModule,
    NgOpenCVModule.forRoot(openCVConfig),
    BrowserAnimationsModule,
    MatGridListModule,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule,
    HttpClientModule,
    MatDialogModule
  ],
  providers: [
    {
       provide: MatDialogRef,
       useValue: {}
     },
  ],
  bootstrap: [AppComponent],
  entryComponents: [
    DialogTakePhotoComponent
  ],
  exports: [DialogTakePhotoComponent]
})
export class AppModule { }

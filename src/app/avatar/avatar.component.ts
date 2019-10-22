import { Component, OnInit, ViewChild } from '@angular/core';
import { ImageCroppedEvent, CropperPosition, ImageCropperComponent } from 'ngx-image-cropper';
import { WebcamInitError, WebcamImage, WebcamUtil } from 'ngx-webcam';
import { Subject, Observable } from 'rxjs';
import { INIT_IMAGE_BASE_64 } from '../constant';
import * as smartcrop from 'smartcrop';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
  // @ViewChild(ImageCropperComponent, {static: false}) imageCropper: ImageCropperComponent;s
  croppedImage: any = '';
  imageBase64 = INIT_IMAGE_BASE_64;
  img: any;
  cropper: CropperPosition = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  };

  public currentCropper: CropperPosition;

  // toggle webcam on/off
  public showWebcam = true;
  public allowCameraSwitch = true;
  public multipleWebcamsAvailable = false;
  public deviceId: string;
  public videoOptions: MediaTrackConstraints = {
    // width: {ideal: 1024},
    // height: {ideal: 576}
  };
  public errors: WebcamInitError[] = [];

  // latest snapshot
  public webcamImage: WebcamImage = null;

  // webcam snapshot trigger
  private trigger: Subject<void> = new Subject<void>();
  // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
  private nextWebcam: Subject<boolean | string> = new Subject<boolean | string>();

  public ngOnInit(): void {
    WebcamUtil.getAvailableVideoInputs()
      .then((mediaDevices: MediaDeviceInfo[]) => {
        this.multipleWebcamsAvailable = mediaDevices && mediaDevices.length > 1;
      });
  }

  public triggerSnapshot(): void {
    this.trigger.next();
  }

  public toggleWebcam(): void {
    this.showWebcam = !this.showWebcam;
  }

  public handleInitError(error: WebcamInitError): void {
    this.errors.push(error);
  }

  public showNextWebcam(directionOrDeviceId: boolean | string): void {
    // true => move forward through devices
    // false => move backwards through devices
    // string => move to device with given deviceId
    this.nextWebcam.next(directionOrDeviceId);
  }

  public handleImage(webcamImage: WebcamImage): void {
    console.info('received webcam image', webcamImage);
    this.webcamImage = webcamImage;
    this.imageBase64 = webcamImage.imageAsDataUrl;

    this.img = new Image();
    this.img.crossOrigin = 'Anonymous';
    this.img.src = webcamImage.imageAsDataUrl;
    this.img.onload = ( _ => {
      this.run();
    });
  }

  run() {
    const options = {
      width: 400,
      height: 600,
      minScale: 1,
      debug: true
    };
    this.analyze(options);
  }

  analyze(options) {
    smartcrop.crop(this.img, options).then(result => {
      console.log('smart crop:', result.topCrop);
      // console.log(this.imageCropper);
      // console.log(this.imageCropper.cropper);
      this.currentCropper = {
        x1: result.topCrop.x,
        y1: result.topCrop.y,
        x2: result.topCrop.width + result.topCrop.x,
        y2: result.topCrop.height + result.topCrop.y
      };
    });
  }

  public cameraWasSwitched(deviceId: string): void {
    console.log('active device: ' + deviceId);
    this.deviceId = deviceId;
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
  }


  imageCropped(event: ImageCroppedEvent) {
    this.croppedImage = event.base64;
  }

  cropperReady() {
    const defaultCropper = {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0
    };
    console.log('this.currentCropper:', this.currentCropper);
    
    this.cropper = this.currentCropper ? this.currentCropper : defaultCropper;
  }
}

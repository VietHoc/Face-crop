import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ImageCroppedEvent, CropperPosition, ImageCropperComponent} from 'ngx-image-cropper';
import {WebcamInitError, WebcamImage, WebcamUtil} from 'ngx-webcam';
import {Subject, Observable, BehaviorSubject, forkJoin} from 'rxjs';
import {INIT_IMAGE_BASE_64} from '../constant';
import * as smartcrop from 'smartcrop';
import {NgOpenCVService, OpenCVLoadResult} from 'ng-open-cv';
import {filter, switchMap, tap} from 'rxjs/operators';
import {MatSnackBar} from '@angular/material';


@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
  imageChangedEvent: any = '';
  croppedImage: any = '';
  imageBase64 = INIT_IMAGE_BASE_64;
  img: any;
  currentFace = 0;
  cropper: CropperPosition = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  };
  options = {
    width: 400,
    height: 600,
    minScale: 1,
    boost: null,
    debug: true
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


  private classifiersLoaded = new BehaviorSubject<boolean>(false);

  constructor(
    private ngOpenCVService: NgOpenCVService,
    private snackBar: MatSnackBar
  ) {
  }

  public ngOnInit(): void {
    WebcamUtil.getAvailableVideoInputs()
      .then((mediaDevices: MediaDeviceInfo[]) => {
        this.multipleWebcamsAvailable = mediaDevices && mediaDevices.length > 1;
      });

    // Always subscribe to the NgOpenCVService isReady$ observer before using a CV related function to ensure that the OpenCV has been
    // successfully loaded
    this.ngOpenCVService.isReady$
      .pipe(
        // The OpenCV library has been successfully loaded if result.ready === true
        filter((result: OpenCVLoadResult) => result.ready),
        switchMap(() => {
          // Load the face and eye classifiers files
          return this.loadClassifiers();
        })
      )
      .subscribe(() => {
        // The classifiers have been succesfully loaded
        this.classifiersLoaded.next(true);
      });
  }

  loadClassifiers(): Observable<any> {
    return forkJoin(
      this.ngOpenCVService.createFileFromUrl(
        'haarcascade_frontalface_default.xml',
        `assets/opencv/data/haarcascades/haarcascade_frontalface_default.xml`
      ),
      this.ngOpenCVService.createFileFromUrl(
        'haarcascade_eye.xml',
        `assets/opencv/data/haarcascades/haarcascade_eye.xml`
      )
    );
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

  public handleImage(webcamImage: WebcamImage): void {
    console.log('received webcam image', webcamImage);
    this.webcamImage = webcamImage;
    this.imageBase64 = webcamImage.imageAsDataUrl;

    this.img = new Image();
    this.img.crossOrigin = 'Anonymous';
    this.img.src = webcamImage.imageAsDataUrl;
    this.img.onload = (_ => {
      const src = cv.imread(this.img);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      const faces = new cv.RectVector();
      const faceCascade = new cv.CascadeClassifier();
      // load pre-trained classifiers
      faceCascade.load('haarcascade_frontalface_default.xml');
      // detect faces
      const msize = new cv.Size(0, 0);
      faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);
      console.log('faces:', faces.size());

      if (faces.size() > 0) {
        this.currentFace = faces.size();
        const boost = [];
        for (let i = 0; i < faces.size(); ++i) {
          const face = faces.get(i);
          boost.push({
            x: face.x,
            y: face.y,
            width: face.width,
            height: face.height,
            weight: 1.0
          });
        }
        this.options.boost = boost;
        setTimeout(_ => {
          this.analyze(this.options);
        });
      } else {
        this.currentFace = 0;
        this.snackBar.open('Show your face in carema!', '', {
          duration: 2000,
        });
      };
    });
  }

  analyze(options) {
    smartcrop.crop(this.img, options).then(result => {
      console.log('smart crop:', result.topCrop);
      this.currentCropper = {
        x1: result.topCrop.x,
        y1: result.topCrop.y,
        x2: result.topCrop.width + result.topCrop.x,
        y2: result.topCrop.height + result.topCrop.y
      };
    });
  }

  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
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
    setTimeout(_ => {
      this.cropper = this.currentCropper ? this.currentCropper : defaultCropper;
    });
  }
}

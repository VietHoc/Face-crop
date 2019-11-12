import {Component, HostListener, OnInit} from '@angular/core';
import {ImageCroppedEvent, CropperPosition} from 'ngx-image-cropper';
import {WebcamInitError, WebcamImage, WebcamUtil} from 'ngx-webcam';
import {Subject, Observable, BehaviorSubject, forkJoin} from 'rxjs';
import {INIT_IMAGE_BASE_64} from '../constant';
import * as
    smartcrop from 'smartcrop';
import {NgOpenCVService, OpenCVLoadResult} from 'ng-open-cv';
import {filter, switchMap, tap} from 'rxjs/operators';
import {MatSnackBar} from '@angular/material';
import {OpenCvService} from '../core/http/open-cv.service';


@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
  public imageChangedEvent: any = '';
  public croppedImage: any = '';
  public imageBase64 = '';
  public img: any;
  public currentFace = 0;
  message = 'No face in camera!';
  responseValidateImage: any;
  image: any;
  isEditByKeyBoard = false;
  public cropper: CropperPosition = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  };
  public options = {
    width: 35,
    height: 45,
    minScale: 0.8,
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
    private snackBar: MatSnackBar,
    private openCvHttp: OpenCvService
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
    console.log(this.imageBase64);

    this.img = new Image();
    this.img.crossOrigin = 'Anonymous';
    this.img.src = webcamImage.imageAsDataUrl;
    this.img.onload = (_ => {
      const src = cv.imread(this.img);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      const faces = new cv.RectVector();
      const eyes = new cv.RectVector();
      const faceCascade = new cv.CascadeClassifier();
      const eyeCascade = new cv.CascadeClassifier();
      // load pre-trained classifiers
      faceCascade.load('haarcascade_frontalface_default.xml');
      eyeCascade.load('haarcascade_eye.xml');
      // detect faces
      const msize = new cv.Size(0, 0);
      faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);
      let eyesOfOnePeople = 0;
      if (faces.size() > 0) {
        this.currentFace = faces.size();
        const boost = [];
        for (let i = 0; i < faces.size(); ++i) {
          const face = faces.get(i);
          const roiGray = gray.roi(face);
          // console.log(face);
          boost.push({
            x: face.x,
            y: face.y,
            width: face.width,
            height: face.height,
            weight: 5.0
          });
          eyeCascade.detectMultiScale(roiGray, eyes);
          eyesOfOnePeople = eyes.size();
        }
        const message = eyesOfOnePeople < 2 ? 'No eyes in the photo' : 'Pass';
        const results = {
          faces: faces.size(),
          eyes: eyesOfOnePeople,
          message
        };
        console.log('Results by OpenCv Javascript:', results);
        this.options.boost = boost;
        setTimeout(res => {
          this.analyze(this.options, faces.get(0));
        });
        src.delete();
        gray.delete();
        faceCascade.delete();
        eyeCascade.delete();
      } else {
        this.currentFace = 0;
        this.message = 'No face in camera!';
        this.snackBar.open('Show your face in camera!', '', {
          duration: 2000,
        });
      }
    });
  }

  analyze(options, face) {
    smartcrop.crop(this.img, options).then(result => {
      // console.log('smart crop:', result.topCrop);
      this.currentCropper = {
        x1: result.topCrop.x,
        y1: (result.topCrop.y + face.y) / 3,
        x2: result.topCrop.width + result.topCrop.x,
        y2: result.topCrop.height + (result.topCrop.y + face.y) / 3
      };
    });
  }

  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
  }

  public cameraWasSwitched(deviceId: string): void {
    // console.log('active device: ' + deviceId);
    this.deviceId = deviceId;
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
  }

  imageCropped(event: ImageCroppedEvent) {
    console.log('this.currentCropper:', this.currentCropper);
    this.croppedImage = event.base64;
  }

  cropperReady() {
    const defaultCropper = {
      x1: 0,
      y1: 0,
      x2: 35,
      y2: 45
    };

    console.log('this.currentCropper:', this.cropper);
    setTimeout(_ => {
      this.cropper = this.currentCropper ? this.currentCropper : defaultCropper;
    }, 10);
  }

  validatePhoto(croppedImage) {
    croppedImage = croppedImage.substring(22, croppedImage.length);
    this.openCvHttp.validatorImage(croppedImage).subscribe(res => {
      this.responseValidateImage = res;
      this.image = `data:image/png;base64,${res[0].image_removed_background}`;
      this.snackBar.open(res[0].message, '', {
        duration: 2000,
      });
    });
  }

  enableEditCropByKeyBoard() {
    this.isEditByKeyBoard = true;
  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (this.isEditByKeyBoard) {
      window.addEventListener('keydown', e => {
        // space and arrow keys
        if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
          e.preventDefault();
        }
      }, false);

      if (event.code === KEY_CODE.ARROW_UP) {
        this.DownY();
      }

      if (event.code === KEY_CODE.ARROW_DOWN) {
        this.UpY();
      }

      if (event.code === KEY_CODE.ARROW_RIGHT) {
        this.UpX();
      }

      if (event.code === KEY_CODE.ARROW_LEFT) {
        this.DownX();
      }

      if (event.code === KEY_CODE.EQUAL) {
        this.zoomIn();
      }

      if (event.code === KEY_CODE.MINUS) {
        this.zoomOut();
      }
    }
  }

  DownX() {
    this.cropper = {
      x1: this.cropper.x1 - 5,
      y1: this.cropper.y1,
      x2: this.cropper.x2 - 5,
      y2: this.cropper.y2
    };
  }

  UpX() {
    this.cropper = {
      x1: this.cropper.x1 + 5,
      y1: this.cropper.y1,
      x2: this.cropper.x2 + 5,
      y2: this.cropper.y2
    };
  }

  DownY() {
    this.cropper = {
      x1: this.cropper.x1,
      y1: this.cropper.y1 - 5,
      x2: this.cropper.x2,
      y2: this.cropper.y2 - 5
    };
  }

  UpY() {
    this.cropper = {
      x1: this.cropper.x1,
      y1: this.cropper.y1 + 5,
      x2: this.cropper.x2,
      y2: this.cropper.y2 + 5
    };
  }

  zoomIn() {
    this.cropper = {
      x1: this.cropper.x1,
      y1: this.cropper.y1,
      x2: this.cropper.x2 * 1.05,
      y2: this.cropper.y2 * 1.05
    };
  }

  zoomOut() {
    this.cropper = {
      x1: this.cropper.x1,
      y1: this.cropper.y1,
      x2: this.cropper.x2 * 0.95,
      y2: this.cropper.y2 * 0.95
    };
  }
}

export enum KEY_CODE {
  ARROW_UP = 'ArrowUp',
  ARROW_DOWN = 'ArrowDown',
  ARROW_RIGHT = 'ArrowRight',
  ARROW_LEFT = 'ArrowLeft',
  EQUAL = 'Equal',
  MINUS = 'Minus'
}

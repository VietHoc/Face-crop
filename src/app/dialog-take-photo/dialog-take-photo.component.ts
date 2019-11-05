import {Component, HostListener, Inject, OnInit} from '@angular/core';
import {INIT_IMAGE_BASE_64, KEY_CODE} from '../constant';
import {WebcamImage, WebcamInitError, WebcamUtil} from 'ngx-webcam';
import {BehaviorSubject, forkJoin, Observable, Subject} from 'rxjs';
import {NgOpenCVService, OpenCVLoadResult} from 'ng-open-cv';
import {MAT_DIALOG_DATA, MatDialogRef, MatSnackBar} from '@angular/material';
import * as smartcrop from 'smartcrop';
import {CropperPosition, ImageCroppedEvent} from 'ngx-image-cropper';
import {filter, switchMap} from 'rxjs/operators';
import {OpenCvService} from '../core/http/open-cv.service';

@Component({
  selector: 'app-dialog-take-photo',
  templateUrl: './dialog-take-photo.component.html',
  styleUrls: ['./dialog-take-photo.component.scss']
})
export class DialogTakePhotoComponent implements OnInit {
  imageChangedEvent: any = '';
  croppedImage: any = '';
  imageBase64 = INIT_IMAGE_BASE_64;
  img: any;
  currentFace = 0;
  message = '';
  isImageOk = false;
  validatorStatus = '';
  isSkipValidator = true;
  public cropper: CropperPosition = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  };
  image: any;
  currentCropper: CropperPosition;
  showWebcam = true;
  allowCameraSwitch = true;
  deviceId: string;
  videoOptions: MediaTrackConstraints = {
    // width: {ideal: 1024},
    // height: {ideal: 576}
  };
  errors: WebcamInitError[] = [];
  webcamImage: WebcamImage = null;
  isEditByKeyBoard = false;
  multipleWebcamsAvailable = false;

  public options = {
    width: 35,
    height: 45,
    minScale: 0.8,
    boost: null,
    debug: true
  };

  private trigger: Subject<void> = new Subject<void>();
  private nextWebcam: Subject<boolean | string> = new Subject<boolean | string>();
  private classifiersLoaded = new BehaviorSubject<boolean>(false);


  constructor(
    private openCvHttp: OpenCvService,
    private ngOpenCVService: NgOpenCVService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<DialogTakePhotoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (!!this.data) {
      this.imageChangedEvent = this.data.imageChangedEvent;
    }
  }

  public ngOnInit(): void {
    WebcamUtil.getAvailableVideoInputs()
      .then((mediaDevices: MediaDeviceInfo[]) => {
        this.multipleWebcamsAvailable = mediaDevices && mediaDevices.length > 1;
      });

    this.ngOpenCVService.isReady$
      .pipe(
        filter((result: OpenCVLoadResult) => result.ready),
        switchMap(() => {
          return this.loadClassifiers();
        })
      )
      .subscribe(() => {
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

  public cameraWasSwitched(deviceId: string): void {
    this.deviceId = deviceId;
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
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
      const msize = new cv.Size(0, 0);
      faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);
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
        this.analyze(this.options, faces.get(0));
        // src.delete();
        // gray.delete();
        // faceCascade.delete();
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
      console.log('result:', result.topCrop);
      console.log('face:', face);
      this.currentCropper = {
        x1: result.topCrop.x - 50,
        y1: result.topCrop.y,
        x2: result.topCrop.x + result.topCrop.width - 50,
        y2: result.topCrop.y + result.topCrop.height
      };
      console.log('topCrop new:', this.currentCropper);
    });
  }

  cropperReady() {
    const defaultCropper = {
      x1: 0,
      y1: 0,
      x2: 35,
      y2: 45
    };
    console.log('currentCropper:', this.currentCropper);

    setTimeout(_ => {
      this.cropper = this.currentCropper ? this.currentCropper : defaultCropper;
    });
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImage = event.base64;
  }

  public handleInitError(error: WebcamInitError): void {
    this.errors.push(error);
  }

  public triggerSnapshot(): void {
    this.trigger.next();
    this.toggleWebcam();
  }

  public toggleWebcam(): void {
    this.showWebcam = !this.showWebcam;
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
      x1: this.cropper.x1 - 10,
      y1: this.cropper.y1,
      x2: this.cropper.x2 - 10,
      y2: this.cropper.y2
    };
  }

  UpX() {
    this.cropper = {
      x1: this.cropper.x1 + 10,
      y1: this.cropper.y1,
      x2: this.cropper.x2 + 10,
      y2: this.cropper.y2
    };
  }

  DownY() {
    this.cropper = {
      x1: this.cropper.x1,
      y1: this.cropper.y1 - 10,
      x2: this.cropper.x2,
      y2: this.cropper.y2 - 10
    };
  }

  UpY() {
    this.cropper = {
      x1: this.cropper.x1,
      y1: this.cropper.y1 + 10,
      x2: this.cropper.x2,
      y2: this.cropper.y2 + 10
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

  onNoClick(): void {
    this.dialogRef.close();
  }

  selectImage() {
    this.dialogRef.close(this.croppedImage);
  }

  validatePhoto(croppedImage) {
    croppedImage = croppedImage.substring(22, croppedImage.length);
    this.openCvHttp.validatorImage(croppedImage).subscribe(res => {
      this.validatorStatus = res;
      this.isSkipValidator = false;
    });
  }

  skipValidator() {
    this.isImageOk = true;
  }
}
